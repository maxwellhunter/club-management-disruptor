import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { createExportSchema } from "@club/shared";
import { generateExport } from "@/lib/accounting";

/**
 * POST /api/accounting/export — Generate a GL export file.
 * Creates an export batch record and returns the generated file content.
 * Admin only.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getMemberWithTier(supabase, user.id);
    if (!result || result.member.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createExportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { format, provider, date_from, date_to } = parsed.data;
    const clubId = result.member.club_id;

    // Create export batch record
    const { data: batch, error: batchError } = await supabase
      .from("export_batches")
      .insert({
        club_id: clubId,
        format,
        provider,
        date_from,
        date_to,
        exported_by: result.member.id,
        status: "pending",
      })
      .select()
      .single();

    if (batchError) throw batchError;

    try {
      // Generate the export
      const exportResult = await generateExport(supabase, clubId, format, date_from, date_to);

      // Update batch with results
      await supabase
        .from("export_batches")
        .update({
          status: "completed",
          entry_count: exportResult.entryCount,
          total_debits: exportResult.totalDebits,
          total_credits: exportResult.totalCredits,
        })
        .eq("id", batch.id);

      return NextResponse.json({
        batch: { ...batch, status: "completed", entry_count: exportResult.entryCount },
        file: {
          content: exportResult.content,
          filename: exportResult.filename,
          mimeType: exportResult.mimeType,
        },
        summary: {
          entryCount: exportResult.entryCount,
          totalDebits: exportResult.totalDebits,
          totalCredits: exportResult.totalCredits,
        },
      });
    } catch (exportError) {
      // Mark batch as failed
      await supabase
        .from("export_batches")
        .update({
          status: "failed",
          error_message: exportError instanceof Error ? exportError.message : "Unknown error",
        })
        .eq("id", batch.id);

      throw exportError;
    }
  } catch (error) {
    console.error("GL export POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { importFieldMappingSchema } from "@club/shared";
import { parseCSV } from "@/lib/migration/csv-parser";
import { validateRows } from "@/lib/migration/validator";
import { executeImport } from "@/lib/migration/importer";

/**
 * POST /api/migration/execute — Execute an import with confirmed field mapping.
 * Takes a batch_id and final mapping, re-validates, and imports into the database.
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
    const parsed = importFieldMappingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { batch_id, mapping } = parsed.data;

    // Load the batch
    const { data: batch, error: batchError } = await supabase
      .from("import_batches")
      .select("*")
      .eq("id", batch_id)
      .eq("club_id", result.member.club_id)
      .single();

    if (batchError || !batch) {
      return NextResponse.json({ error: "Import batch not found" }, { status: 404 });
    }

    if (batch.status !== "preview") {
      return NextResponse.json(
        { error: `Cannot execute batch in "${batch.status}" status` },
        { status: 400 },
      );
    }

    // Update status to importing
    await supabase
      .from("import_batches")
      .update({ status: "importing", field_mapping: mapping })
      .eq("id", batch_id);

    try {
      // We need the original CSV data. Since we don't store file content,
      // the client must re-send it OR we store in Supabase Storage.
      // For this implementation, the client re-uploads with the execute request.
      const csvContent = body.csv_content as string | undefined;
      if (!csvContent) {
        // Fallback: check if body has rows directly
        const rows = body.rows as Record<string, string>[] | undefined;
        if (!rows || rows.length === 0) {
          await supabase.from("import_batches").update({ status: "failed" }).eq("id", batch_id);
          return NextResponse.json({ error: "Missing CSV content or rows" }, { status: 400 });
        }

        // Validate and import directly from rows
        const { validRows } = validateRows(rows, mapping, batch.entity_type);
        const importResult = await executeImport(
          supabase,
          result.member.club_id,
          batch.entity_type,
          validRows,
          mapping,
          result.member.id,
        );

        await supabase
          .from("import_batches")
          .update({
            status: "completed",
            imported_rows: importResult.imported,
            skipped_rows: importResult.skipped,
            field_mapping: mapping,
            completed_at: new Date().toISOString(),
          })
          .eq("id", batch_id);

        return NextResponse.json({
          batch_id,
          status: "completed",
          imported: importResult.imported,
          skipped: importResult.skipped,
          errors: importResult.errors.slice(0, 50),
        });
      }

      // Parse CSV and import
      const csv = parseCSV(csvContent);
      const { validRows } = validateRows(csv.rows, mapping, batch.entity_type);

      const importResult = await executeImport(
        supabase,
        result.member.club_id,
        batch.entity_type,
        validRows,
        mapping,
        result.member.id,
      );

      await supabase
        .from("import_batches")
        .update({
          status: "completed",
          imported_rows: importResult.imported,
          skipped_rows: importResult.skipped,
          field_mapping: mapping,
          completed_at: new Date().toISOString(),
        })
        .eq("id", batch_id);

      return NextResponse.json({
        batch_id,
        status: "completed",
        imported: importResult.imported,
        skipped: importResult.skipped,
        errors: importResult.errors.slice(0, 50),
      });
    } catch (importError) {
      await supabase
        .from("import_batches")
        .update({
          status: "failed",
          errors: [{ row: 0, field: "", value: "", message: importError instanceof Error ? importError.message : "Unknown error" }],
        })
        .eq("id", batch_id);

      throw importError;
    }
  } catch (error) {
    console.error("Migration execute error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

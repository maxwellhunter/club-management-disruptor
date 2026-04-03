import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";

/**
 * GET /api/migration — Import history and stats.
 * Admin only.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getMemberWithTier(supabase, user.id);
    if (!result || result.member.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const clubId = result.member.club_id;

    const [batchesRes, memberCountRes, invoiceCountRes] = await Promise.all([
      supabase
        .from("import_batches")
        .select("*")
        .eq("club_id", clubId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("import_batches")
        .select("imported_rows")
        .eq("club_id", clubId)
        .eq("entity_type", "members")
        .eq("status", "completed"),
      supabase
        .from("import_batches")
        .select("imported_rows")
        .eq("club_id", clubId)
        .eq("entity_type", "invoices")
        .eq("status", "completed"),
    ]);

    const batches = batchesRes.data ?? [];
    const totalMembersImported = (memberCountRes.data ?? []).reduce(
      (sum: number, b: { imported_rows: number }) => sum + b.imported_rows, 0,
    );
    const totalInvoicesImported = (invoiceCountRes.data ?? []).reduce(
      (sum: number, b: { imported_rows: number }) => sum + b.imported_rows, 0,
    );

    return NextResponse.json({
      recentImports: batches,
      stats: {
        totalImports: batches.length,
        totalMembersImported,
        totalInvoicesImported,
        lastImportDate: batches[0]?.created_at ?? null,
      },
    });
  } catch (error) {
    console.error("Migration GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

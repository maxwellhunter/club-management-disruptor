import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";

/**
 * GET /api/accounting — Summary dashboard data for accounting admin.
 * Returns GL accounts, mappings, recent exports, unmapped categories, and period summary.
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

    // Fetch all accounting data in parallel
    const [accountsRes, mappingsRes, exportsRes, invoicesRes, paymentsRes, posRes] = await Promise.all([
      supabase
        .from("gl_accounts")
        .select("*")
        .eq("club_id", clubId)
        .order("account_number"),
      supabase
        .from("gl_mappings")
        .select("*, gl_accounts(name, account_number)")
        .eq("club_id", clubId),
      supabase
        .from("export_batches")
        .select("*")
        .eq("club_id", clubId)
        .order("created_at", { ascending: false })
        .limit(10),
      // Period summary: current month invoices
      supabase
        .from("invoices")
        .select("amount, status")
        .eq("club_id", clubId)
        .gte("due_date", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)),
      // Current month payments
      supabase
        .from("payments")
        .select("amount")
        .eq("club_id", clubId)
        .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      // Current month POS sales
      supabase
        .from("pos_transactions")
        .select("total, status")
        .eq("club_id", clubId)
        .eq("status", "completed")
        .gte("created_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    ]);

    const glAccounts = accountsRes.data ?? [];
    const rawMappings = mappingsRes.data ?? [];
    const recentExports = exportsRes.data ?? [];
    const invoices = invoicesRes.data ?? [];
    const payments = paymentsRes.data ?? [];
    const posTransactions = posRes.data ?? [];

    // Transform mappings to include account info
    const mappings = rawMappings.map((m: Record<string, unknown>) => {
      const acct = m.gl_accounts as { name: string; account_number: string } | null;
      return {
        id: m.id,
        club_id: m.club_id,
        source_category: m.source_category,
        gl_account_id: m.gl_account_id,
        description: m.description,
        created_at: m.created_at,
        account_name: acct?.name ?? "",
        account_number: acct?.account_number ?? "",
      };
    });

    // Determine unmapped categories
    const allCategories = [
      "membership_dues",
      "dining_revenue",
      "bar_revenue",
      "pro_shop_revenue",
      "snack_bar_revenue",
      "other_revenue",
      "accounts_receivable",
      "cash",
    ];
    const mappedCategories = new Set(rawMappings.map((m: Record<string, unknown>) => m.source_category));
    const unmappedCategories = allCategories.filter((c) => !mappedCategories.has(c));

    // Period summary
    const revenue = invoices.reduce((sum: number, i: Record<string, unknown>) => sum + Number(i.amount), 0);
    const paymentTotal = payments.reduce((sum: number, p: Record<string, unknown>) => sum + Number(p.amount), 0);
    const posSales = posTransactions.reduce((sum: number, t: Record<string, unknown>) => sum + Number(t.total), 0);
    const outstanding = invoices
      .filter((i: Record<string, unknown>) => i.status === "sent" || i.status === "overdue")
      .reduce((sum: number, i: Record<string, unknown>) => sum + Number(i.amount), 0);

    return NextResponse.json({
      glAccounts,
      mappings,
      recentExports,
      unmappedCategories,
      periodSummary: { revenue, payments: paymentTotal, posSales, outstanding },
    });
  } catch (error) {
    console.error("Accounting GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

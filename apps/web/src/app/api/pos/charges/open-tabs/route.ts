import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";

/**
 * GET /api/pos/charges/open-tabs — List members with open (uninvoiced) charges.
 * Admin or staff only.
 * Query params:
 *   period — (optional) YYYY-MM, defaults to current month
 */
export async function GET(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getMemberWithTier(supabase, user.id);
    if (!result) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    if (result.member.role === "member") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(request.url);
    const now = new Date();
    const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const period = url.searchParams.get("period") ?? defaultPeriod;

    const clubId = result.member.club_id;

    // Get all uninvoiced member_charge transactions grouped by member
    const { data: transactions, error: txnError } = await supabase
      .from("pos_transactions")
      .select("member_id, total")
      .eq("club_id", clubId)
      .eq("billing_period", period)
      .eq("payment_method", "member_charge")
      .is("invoice_id", null)
      .not("member_id", "is", null);

    if (txnError) {
      console.error("Open tabs query error:", txnError);
      return NextResponse.json({ error: "Failed to fetch open tabs" }, { status: 500 });
    }

    if (!transactions || transactions.length === 0) {
      return NextResponse.json({ tabs: [], period });
    }

    // Aggregate in JS since Supabase PostgREST doesn't support GROUP BY
    const memberTotals = new Map<string, { count: number; total: number }>();
    for (const txn of transactions) {
      if (!txn.member_id) continue;
      const existing = memberTotals.get(txn.member_id) ?? { count: 0, total: 0 };
      existing.count += 1;
      existing.total += Number(txn.total);
      memberTotals.set(txn.member_id, existing);
    }

    const memberIds = Array.from(memberTotals.keys());

    // Fetch member names
    const { data: members } = await supabase
      .from("members")
      .select("id, first_name, last_name, member_number")
      .in("id", memberIds);

    const memberMap = new Map(
      (members ?? []).map((m) => [m.id, m])
    );

    const tabs = memberIds.map((memberId) => {
      const agg = memberTotals.get(memberId)!;
      const member = memberMap.get(memberId);
      return {
        member_id: memberId,
        first_name: member?.first_name ?? "Unknown",
        last_name: member?.last_name ?? "",
        member_number: member?.member_number ?? null,
        tx_count: agg.count,
        tab_total: Math.round(agg.total * 100) / 100,
      };
    });

    // Sort by tab total descending
    tabs.sort((a, b) => b.tab_total - a.tab_total);

    return NextResponse.json({ tabs, period });
  } catch (error) {
    console.error("GET /api/pos/charges/open-tabs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

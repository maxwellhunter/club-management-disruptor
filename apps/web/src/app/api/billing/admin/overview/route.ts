import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import type { BillingOverview } from "@club/shared";

export async function GET(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await getMemberWithTier(supabase, user.id);
    if (!result) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Admin only
    if (result.member.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const clubId = result.member.club_id;

    // Outstanding balance (unpaid invoices)
    const { data: unpaidInvoices } = await supabase
      .from("invoices")
      .select("amount")
      .eq("club_id", clubId)
      .in("status", ["sent", "overdue"]);

    const outstandingBalance = (unpaidInvoices ?? []).reduce(
      (sum, inv) => sum + Number(inv.amount),
      0
    );

    // Collected this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: monthPayments } = await supabase
      .from("payments")
      .select("amount")
      .eq("club_id", clubId)
      .gte("created_at", startOfMonth.toISOString());

    const collectedMtd = (monthPayments ?? []).reduce(
      (sum, pay) => sum + Number(pay.amount),
      0
    );

    // Overdue count
    const { count: overdueCount } = await supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("club_id", clubId)
      .eq("status", "overdue");

    // Recent invoices with member names
    const { data: recentInvoices } = await supabase
      .from("invoices")
      .select(
        `
        *,
        members (
          first_name,
          last_name
        )
      `
      )
      .eq("club_id", clubId)
      .order("created_at", { ascending: false })
      .limit(20);

    const invoicesWithNames = (recentInvoices ?? []).map((inv) => {
      const member = inv.members as unknown as {
        first_name: string;
        last_name: string;
      } | null;
      return {
        ...inv,
        members: undefined,
        member_name: member
          ? `${member.first_name} ${member.last_name}`
          : "Unknown",
      };
    });

    const overview: BillingOverview = {
      outstandingBalance,
      collectedMtd,
      overdueCount: overdueCount ?? 0,
      recentInvoices: invoicesWithNames,
    };

    return NextResponse.json(overview);
  } catch (error) {
    console.error("Billing admin overview error:", error);
    return NextResponse.json(
      { error: "Failed to fetch billing overview" },
      { status: 500 }
    );
  }
}

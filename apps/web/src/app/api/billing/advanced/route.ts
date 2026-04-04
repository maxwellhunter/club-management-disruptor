import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import type { AdvancedBillingSummary } from "@club/shared";

/**
 * GET /api/billing/advanced — Advanced billing dashboard summary
 */
export async function GET(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const caller = await getMemberWithTier(supabase, user.id);
    if (!caller || caller.member.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const clubId = caller.member.club_id;
    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all data in parallel
    const [minimums, assessments, cycles, familiesData] = await Promise.all([
      adminClient
        .from("spending_minimums")
        .select("*, membership_tiers(name, level)")
        .eq("club_id", clubId)
        .order("created_at", { ascending: false }),
      adminClient
        .from("assessments")
        .select("*")
        .eq("club_id", clubId)
        .order("created_at", { ascending: false })
        .limit(20),
      adminClient
        .from("billing_cycles")
        .select("*")
        .eq("club_id", clubId)
        .order("created_at", { ascending: false })
        .limit(10),
      adminClient
        .from("families")
        .select("id, name, primary_member_id, billing_consolidated, billing_email")
        .eq("club_id", clubId),
    ]);

    // Enrich minimums with tier info
    const enrichedMinimums = (minimums.data ?? []).map((m) => {
      const tiers = m.membership_tiers as unknown as { name: string; level: string }[] | null;
      const tier = tiers?.[0] ?? (m.membership_tiers as unknown as { name: string; level: string } | null);
      return {
        ...m,
        tier_name: tier?.name ?? "Unknown",
        tier_level: tier?.level ?? "standard",
        membership_tiers: undefined,
      };
    });

    // Enrich families with member info
    const familyList = familiesData.data ?? [];
    const familyInfos = [];

    for (const family of familyList) {
      const { data: familyMembers } = await adminClient
        .from("members")
        .select("id, first_name, last_name")
        .eq("club_id", clubId)
        .eq("family_id", family.id);

      // Get outstanding balance per family member
      const membersWithBalance = [];
      for (const fm of familyMembers ?? []) {
        const { data: outstandingInvoices } = await adminClient
          .from("invoices")
          .select("amount")
          .eq("member_id", fm.id)
          .in("status", ["sent", "overdue"]);
        const balance = (outstandingInvoices ?? []).reduce((sum, inv) => sum + Number(inv.amount), 0);
        membersWithBalance.push({
          id: fm.id,
          first_name: fm.first_name,
          last_name: fm.last_name,
          outstanding_balance: balance,
        });
      }

      const primaryMember = familyMembers?.find((m) => m.id === family.primary_member_id);

      familyInfos.push({
        family_id: family.id,
        family_name: family.name,
        primary_member_id: family.primary_member_id,
        primary_member_name: primaryMember
          ? `${primaryMember.first_name} ${primaryMember.last_name}`
          : "Unknown",
        billing_consolidated: family.billing_consolidated ?? true,
        billing_email: family.billing_email,
        members: membersWithBalance,
        total_outstanding: membersWithBalance.reduce((sum, m) => sum + m.outstanding_balance, 0),
      });
    }

    // Compute stats
    const activeMinimums = enrichedMinimums.filter((m) => m.is_active).length;
    const activeAssessments = (assessments.data ?? []).filter((a) => a.status === "active").length;
    const totalAssessed = (assessments.data ?? []).reduce((sum, a) => sum + Number(a.total_assessed), 0);
    const totalCollected = (assessments.data ?? []).reduce((sum, a) => sum + Number(a.total_collected), 0);
    const familiesWithConsolidation = familyInfos.filter((f) => f.billing_consolidated).length;

    // Count pending shortfalls
    const { count: shortfallPending } = await adminClient
      .from("spending_tracking")
      .select("*", { count: "exact", head: true })
      .eq("club_id", clubId)
      .gt("shortfall", 0)
      .eq("shortfall_invoiced", false);

    const summary: AdvancedBillingSummary = {
      spending_minimums: enrichedMinimums,
      assessments: assessments.data ?? [],
      recent_cycles: cycles.data ?? [],
      families: familyInfos,
      stats: {
        active_minimums: activeMinimums,
        active_assessments: activeAssessments,
        total_assessed: totalAssessed,
        total_collected: totalCollected,
        families_with_consolidation: familiesWithConsolidation,
        shortfall_pending: shortfallPending ?? 0,
      },
    };

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Advanced billing summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

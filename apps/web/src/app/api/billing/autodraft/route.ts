import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { runAutodraft } from "@/lib/stripe-payments";

/**
 * GET /api/billing/autodraft?period=2026-04
 * Get auto-draft run history + settings.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getMemberWithTier(supabase, user.id);
    if (!result || result.member.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const url = new URL(request.url);
    const period = url.searchParams.get("period");
    const clubId = result.member.club_id;

    // Get settings
    const { data: settings } = await supabase
      .from("autodraft_settings")
      .select("*")
      .eq("club_id", clubId)
      .single();

    // Get runs (optionally filtered by period)
    let runsQuery = supabase
      .from("autodraft_runs")
      .select("*")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (period) {
      runsQuery = runsQuery.eq("period", period);
    }

    const { data: runs } = await runsQuery;

    // If there's a latest run, get its items
    let items = null;
    if (runs && runs.length > 0) {
      const latestRun = runs[0];
      const { data: runItems } = await supabase
        .from("autodraft_items")
        .select(`
          *,
          members:member_id (first_name, last_name, member_number),
          payment_methods:payment_method_id (label, type)
        `)
        .eq("run_id", latestRun.id)
        .order("status", { ascending: true });

      items = (runItems ?? []).map((item) => {
        const member = item.members as unknown as { first_name: string; last_name: string; member_number: string | null } | null;
        const pm = item.payment_methods as unknown as { label: string; type: string } | null;
        return {
          ...item,
          member_name: `${member?.first_name ?? ""} ${member?.last_name ?? ""}`.trim(),
          member_number: member?.member_number ?? null,
          payment_method_label: pm?.label ?? null,
          payment_method_type: pm?.type ?? null,
          members: undefined,
          payment_methods: undefined,
        };
      });
    }

    // Count members with payment methods on file
    const { count: membersWithPm } = await supabase
      .from("payment_methods")
      .select("member_id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .eq("status", "active")
      .eq("is_default", true);

    const { count: totalActive } = await supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .eq("status", "active");

    return NextResponse.json({
      settings: settings ?? {
        enabled: false,
        draft_day_of_month: 15,
        grace_period_days: 10,
        retry_failed: true,
        max_retries: 2,
        notify_members: true,
        advance_notice_days: 3,
      },
      runs: runs ?? [],
      items,
      stats: {
        members_with_payment_method: membersWithPm ?? 0,
        total_active_members: totalActive ?? 0,
      },
    });
  } catch (error) {
    console.error("GET /api/billing/autodraft error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/billing/autodraft
 * Trigger an auto-draft run.
 * Body: { period: "2026-04", dry_run?: boolean }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getMemberWithTier(supabase, user.id);
    if (!result || result.member.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const period = body.period;
    const dryRun = body.dry_run === true;

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ error: "period required (YYYY-MM)" }, { status: 400 });
    }

    const adminClient = getSupabaseAdmin();
    const draftResult = await runAutodraft(adminClient, {
      clubId: result.member.club_id,
      period,
      runBy: result.member.id,
      dryRun,
    });

    return NextResponse.json(draftResult, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("POST /api/billing/autodraft error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/billing/autodraft
 * Update auto-draft settings.
 * Body: { enabled, draft_day_of_month, grace_period_days, ... }
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getMemberWithTier(supabase, user.id);
    if (!result || result.member.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const clubId = result.member.club_id;

    const adminClient = getSupabaseAdmin();

    // Upsert settings
    const { data: settings, error } = await adminClient
      .from("autodraft_settings")
      .upsert(
        {
          club_id: clubId,
          enabled: body.enabled ?? false,
          draft_day_of_month: body.draft_day_of_month ?? 15,
          grace_period_days: body.grace_period_days ?? 10,
          retry_failed: body.retry_failed ?? true,
          max_retries: body.max_retries ?? 2,
          notify_members: body.notify_members ?? true,
          advance_notice_days: body.advance_notice_days ?? 3,
        },
        { onConflict: "club_id" }
      )
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: `Failed to update settings: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("PATCH /api/billing/autodraft error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

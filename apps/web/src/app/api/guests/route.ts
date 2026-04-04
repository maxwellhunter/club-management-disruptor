import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { createGuestSchema } from "@club/shared";
import type { GuestManagementSummary } from "@club/shared";

/**
 * GET /api/guests — Guest management dashboard summary
 * POST /api/guests — Register a new guest
 */
export async function GET(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const caller = await getMemberWithTier(supabase, user.id);
    if (!caller) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const clubId = caller.member.club_id;
    const isAdmin = caller.member.role === "admin";
    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const today = now.toISOString().split("T")[0];

    const [policiesRes, guestsRes, visitsRes, feeSchedulesRes, monthVisitsRes, upcomingRes] = await Promise.all([
      adminClient.from("guest_policies").select("*").eq("club_id", clubId).order("created_at", { ascending: false }),
      adminClient.from("guests").select("*").eq("club_id", clubId).order("last_visit_date", { ascending: false }).limit(100),
      // Recent visits with guest + host names
      adminClient.from("guest_visits")
        .select("*, guests(first_name, last_name), members(first_name, last_name)")
        .eq("club_id", clubId)
        .order("visit_date", { ascending: false })
        .limit(50),
      adminClient.from("guest_fee_schedules")
        .select("*, membership_tiers(name)")
        .eq("club_id", clubId),
      // Stats: visits this month
      adminClient.from("guest_visits")
        .select("guest_fee", { count: "exact" })
        .eq("club_id", clubId)
        .gte("visit_date", monthStart)
        .not("status", "eq", "cancelled"),
      // Upcoming visits (registered but not checked in)
      adminClient.from("guest_visits")
        .select("id", { count: "exact", head: true })
        .eq("club_id", clubId)
        .gte("visit_date", today)
        .eq("status", "registered"),
    ]);

    // Enrich visits with names
    const enrichedVisits = (visitsRes.data ?? []).map((v) => {
      const guestArr = v.guests as unknown as { first_name: string; last_name: string }[] | null;
      const guest = Array.isArray(guestArr) ? guestArr[0] : (guestArr as { first_name: string; last_name: string } | null);
      const hostArr = v.members as unknown as { first_name: string; last_name: string }[] | null;
      const host = Array.isArray(hostArr) ? hostArr[0] : (hostArr as { first_name: string; last_name: string } | null);
      return {
        ...v,
        guest_first_name: guest?.first_name ?? "Unknown",
        guest_last_name: guest?.last_name ?? "",
        host_first_name: host?.first_name ?? "Unknown",
        host_last_name: host?.last_name ?? "",
        guests: undefined,
        members: undefined,
      };
    });

    // Enrich fee schedules with tier names
    const enrichedFees = (feeSchedulesRes.data ?? []).map((f) => {
      const tierArr = f.membership_tiers as unknown as { name: string }[] | null;
      const tier = Array.isArray(tierArr) ? tierArr[0] : (tierArr as { name: string } | null);
      return {
        ...f,
        tier_name: tier?.name ?? null,
        membership_tiers: undefined,
      };
    });

    // Compute stats
    const guestFeeThisMonth = (monthVisitsRes.data ?? []).reduce(
      (sum, v) => sum + Number(v.guest_fee ?? 0), 0
    );

    const blockedGuests = (guestsRes.data ?? []).filter((g) => g.is_blocked).length;

    // If not admin, filter to only show member's own visits
    const filteredVisits = isAdmin
      ? enrichedVisits
      : enrichedVisits.filter((v) => v.host_member_id === caller.member.id);

    const summary: GuestManagementSummary = {
      policies: policiesRes.data ?? [],
      guests: isAdmin ? (guestsRes.data ?? []) : [],
      recent_visits: filteredVisits,
      fee_schedules: enrichedFees,
      stats: {
        total_guests: (guestsRes.data ?? []).length,
        visits_this_month: monthVisitsRes.count ?? 0,
        guest_fees_this_month: guestFeeThisMonth,
        blocked_guests: blockedGuests,
        upcoming_visits: upcomingRes.count ?? 0,
      },
    };

    return NextResponse.json({ ...summary, role: caller.member.role });
  } catch (error) {
    console.error("Guest management error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const caller = await getMemberWithTier(supabase, user.id);
    if (!caller) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const body = await request.json();
    const parsed = createGuestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check for existing guest by email
    if (parsed.data.email) {
      const { data: existing } = await adminClient
        .from("guests")
        .select("id")
        .eq("club_id", caller.member.club_id)
        .eq("email", parsed.data.email)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ guest: existing, existing: true });
      }
    }

    const { data: guest, error } = await adminClient
      .from("guests")
      .insert({
        club_id: caller.member.club_id,
        ...parsed.data,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ guest }, { status: 201 });
  } catch (error) {
    console.error("Create guest error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

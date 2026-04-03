import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";

/**
 * GET /api/reports — Aggregated reporting & analytics data.
 * Admin-only. Returns membership, revenue, booking, and event metrics.
 */
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

    const { member } = result;
    if (member.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const clubId = member.club_id;
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const monthStart = `${todayStr.substring(0, 7)}-01`;

    // Calculate past 6 months boundaries
    const months: { label: string; start: string; end: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      months.push({
        label: d.toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        }),
        start: d.toISOString().split("T")[0],
        end: new Date(nextMonth.getTime() - 1).toISOString().split("T")[0],
      });
    }

    // ── Membership metrics ──────────────────────────────────

    const { count: totalMembers } = await supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId);

    const { count: activeMembers } = await supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .eq("status", "active");

    const { count: pendingMembers } = await supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .in("status", ["pending", "invited"]);

    const { count: inactiveMembers } = await supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .in("status", ["inactive", "suspended"]);

    // Members by tier
    const { data: tierData } = await supabase
      .from("membership_tiers")
      .select("id, name, level")
      .eq("club_id", clubId)
      .eq("is_active", true)
      .order("name");

    const membersByTier: { name: string; count: number }[] = [];
    for (const tier of tierData ?? []) {
      const { count } = await supabase
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("club_id", clubId)
        .eq("membership_tier_id", tier.id)
        .eq("status", "active");
      membersByTier.push({ name: tier.name, count: count ?? 0 });
    }

    // Members with no tier
    const { count: noTierCount } = await supabase
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .eq("status", "active")
      .is("membership_tier_id", null);
    if ((noTierCount ?? 0) > 0) {
      membersByTier.push({ name: "No Tier", count: noTierCount ?? 0 });
    }

    // ── Revenue metrics ─────────────────────────────────────

    // Revenue MTD
    const { data: paidMtd } = await supabase
      .from("invoices")
      .select("amount")
      .eq("club_id", clubId)
      .eq("status", "paid")
      .gte("paid_at", monthStart);

    const revenueMtd = (paidMtd ?? []).reduce(
      (sum, inv) => sum + (inv.amount ?? 0),
      0
    );

    // Outstanding balance
    const { data: outstandingInvoices } = await supabase
      .from("invoices")
      .select("amount")
      .eq("club_id", clubId)
      .in("status", ["sent", "overdue"]);

    const outstandingBalance = (outstandingInvoices ?? []).reduce(
      (sum, inv) => sum + (inv.amount ?? 0),
      0
    );

    // Overdue count
    const { count: overdueCount } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .eq("status", "overdue");

    // Revenue by month (last 6 months)
    const revenueByMonth: { label: string; revenue: number }[] = [];
    for (const m of months) {
      const { data: monthInvoices } = await supabase
        .from("invoices")
        .select("amount")
        .eq("club_id", clubId)
        .eq("status", "paid")
        .gte("paid_at", m.start)
        .lte("paid_at", m.end + "T23:59:59");

      revenueByMonth.push({
        label: m.label,
        revenue: (monthInvoices ?? []).reduce(
          (sum, inv) => sum + (inv.amount ?? 0),
          0
        ),
      });
    }

    // ── Booking metrics ─────────────────────────────────────

    // Bookings this month
    const { count: bookingsThisMonth } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .gte("date", monthStart)
      .lte("date", todayStr)
      .in("status", ["confirmed", "completed"]);

    // Bookings today
    const { count: bookingsToday } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .eq("date", todayStr)
      .in("status", ["confirmed", "pending"]);

    // Cancellations this month
    const { count: cancellationsThisMonth } = await supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .gte("date", monthStart)
      .eq("status", "cancelled");

    // Bookings by facility type
    const { data: bookingsByFacilityRaw } = await supabase
      .from("bookings")
      .select("facilities(type)")
      .eq("club_id", clubId)
      .gte("date", monthStart)
      .in("status", ["confirmed", "completed"]);

    const facilityCounts: Record<string, number> = {};
    for (const b of bookingsByFacilityRaw ?? []) {
      const type =
        (b.facilities as unknown as { type: string } | null)?.type ?? "other";
      facilityCounts[type] = (facilityCounts[type] ?? 0) + 1;
    }
    const bookingsByFacility = Object.entries(facilityCounts).map(
      ([type, count]) => ({ type, count })
    );

    // Bookings by month (last 6 months)
    const bookingsByMonth: { label: string; count: number }[] = [];
    for (const m of months) {
      const { count } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("club_id", clubId)
        .gte("date", m.start)
        .lte("date", m.end)
        .in("status", ["confirmed", "completed"]);

      bookingsByMonth.push({ label: m.label, count: count ?? 0 });
    }

    // ── Event metrics ───────────────────────────────────────

    // Total events this month
    const { count: eventsThisMonth } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .gte("start_date", monthStart + "T00:00:00")
      .eq("status", "published");

    // Upcoming events
    const { count: upcomingEvents } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .gte("start_date", today.toISOString())
      .eq("status", "published");

    // Total RSVPs this month
    const { data: monthEvents } = await supabase
      .from("events")
      .select("id, title, capacity")
      .eq("club_id", clubId)
      .gte("start_date", monthStart + "T00:00:00")
      .eq("status", "published");

    const topEvents: {
      title: string;
      attendees: number;
      capacity: number | null;
    }[] = [];
    for (const event of (monthEvents ?? []).slice(0, 10)) {
      const { count: attendeeCount } = await supabase
        .from("event_rsvps")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("status", "attending");

      topEvents.push({
        title: event.title,
        attendees: attendeeCount ?? 0,
        capacity: event.capacity,
      });
    }
    topEvents.sort((a, b) => b.attendees - a.attendees);

    // Total RSVPs
    let totalRsvps = 0;
    for (const e of topEvents) {
      totalRsvps += e.attendees;
    }

    return NextResponse.json({
      membership: {
        total: totalMembers ?? 0,
        active: activeMembers ?? 0,
        pending: pendingMembers ?? 0,
        inactive: inactiveMembers ?? 0,
        byTier: membersByTier,
      },
      revenue: {
        mtd: revenueMtd,
        outstanding: outstandingBalance,
        overdueCount: overdueCount ?? 0,
        byMonth: revenueByMonth,
      },
      bookings: {
        thisMonth: bookingsThisMonth ?? 0,
        today: bookingsToday ?? 0,
        cancellations: cancellationsThisMonth ?? 0,
        byFacility: bookingsByFacility,
        byMonth: bookingsByMonth,
      },
      events: {
        thisMonth: eventsThisMonth ?? 0,
        upcoming: upcomingEvents ?? 0,
        totalRsvps,
        topEvents: topEvents.slice(0, 5),
      },
    });
  } catch (error) {
    console.error("Reports API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

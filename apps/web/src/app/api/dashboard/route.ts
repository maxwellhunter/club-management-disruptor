import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";

/**
 * GET /api/dashboard — Aggregated dashboard stats.
 * Admin: full club overview.
 * Member: personal summary.
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
    const clubId = member.club_id;
    const isAdmin = member.role === "admin";
    const today = new Date().toISOString().split("T")[0];

    // ── Shared queries (both admin & member) ──────────────────

    // Upcoming events (published, future)
    const { data: upcomingEvents } = await supabase
      .from("events")
      .select("id, title, start_date, location, capacity")
      .eq("club_id", clubId)
      .eq("status", "published")
      .gte("start_date", new Date().toISOString())
      .order("start_date", { ascending: true })
      .limit(5);

    // Latest announcements
    const { data: recentAnnouncements } = await supabase
      .from("announcements")
      .select("id, title, priority, published_at, target_tier_ids")
      .eq("club_id", clubId)
      .not("published_at", "is", null)
      .order("published_at", { ascending: false })
      .limit(5);

    // Filter announcements by member tier if not admin
    let filteredAnnouncements = recentAnnouncements ?? [];
    if (!isAdmin && member.membership_tier_id) {
      filteredAnnouncements = filteredAnnouncements.filter((a) => {
        if (!a.target_tier_ids || a.target_tier_ids.length === 0) return true;
        return a.target_tier_ids.includes(member.membership_tier_id!);
      });
    }

    if (isAdmin) {
      // ── Admin-only queries ──────────────────────────────────

      // Active member count
      const { count: activeMemberCount } = await supabase
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("club_id", clubId)
        .eq("status", "active");

      // Bookings today
      const { count: bookingsToday } = await supabase
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("club_id", clubId)
        .eq("date", today)
        .in("status", ["confirmed", "pending"]);

      // Revenue MTD (sum of paid invoices this month)
      const monthStart = `${today.substring(0, 7)}-01`;
      const { data: paidInvoices } = await supabase
        .from("invoices")
        .select("amount")
        .eq("club_id", clubId)
        .eq("status", "paid")
        .gte("paid_at", monthStart);

      const revenueMtd = (paidInvoices ?? []).reduce(
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

      // Pending invites
      const { count: pendingInvites } = await supabase
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("club_id", clubId)
        .eq("status", "invited");

      // Recent bookings (today + next 3 days)
      const threeDaysOut = new Date();
      threeDaysOut.setDate(threeDaysOut.getDate() + 3);
      const { data: recentBookings } = await supabase
        .from("bookings")
        .select(
          "id, date, start_time, party_size, status, facilities(name, type), members(first_name, last_name)"
        )
        .eq("club_id", clubId)
        .gte("date", today)
        .lte("date", threeDaysOut.toISOString().split("T")[0])
        .in("status", ["confirmed", "pending"])
        .order("date", { ascending: true })
        .order("start_time", { ascending: true })
        .limit(8);

      return NextResponse.json({
        role: "admin",
        memberName: member.first_name,
        stats: {
          activeMembers: activeMemberCount ?? 0,
          bookingsToday: bookingsToday ?? 0,
          revenueMtd,
          outstandingBalance,
          upcomingEvents: (upcomingEvents ?? []).length,
          pendingInvites: pendingInvites ?? 0,
        },
        recentBookings: recentBookings ?? [],
        upcomingEvents: upcomingEvents ?? [],
        recentAnnouncements: filteredAnnouncements,
      });
    } else {
      // ── Member queries ──────────────────────────────────────

      // My upcoming bookings
      const { data: myBookings } = await supabase
        .from("bookings")
        .select(
          "id, date, start_time, party_size, status, facilities(name, type)"
        )
        .eq("member_id", member.id)
        .gte("date", today)
        .in("status", ["confirmed", "pending"])
        .order("date", { ascending: true })
        .limit(5);

      // My RSVPs
      const { data: myRsvps } = await supabase
        .from("event_rsvps")
        .select("id, status, events(id, title, start_date, location)")
        .eq("member_id", member.id)
        .eq("status", "attending")
        .limit(5);

      return NextResponse.json({
        role: "member",
        memberName: member.first_name,
        tierName: result.member.tier_name,
        stats: {
          upcomingBookings: (myBookings ?? []).length,
          upcomingEvents: (upcomingEvents ?? []).length,
          eventsAttending: (myRsvps ?? []).length,
        },
        myBookings: myBookings ?? [],
        myRsvps: myRsvps ?? [],
        upcomingEvents: upcomingEvents ?? [],
        recentAnnouncements: filteredAnnouncements,
      });
    }
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

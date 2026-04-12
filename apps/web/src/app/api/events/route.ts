import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import type { EventWithRsvp, RsvpStatus } from "@club/shared";

export async function GET(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get member to determine club_id
    const result = await getMemberWithTier(supabase, user.id);
    if (!result) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    const isAdmin = result.member.role === "admin";
    const { searchParams } = new URL(request.url);
    const timeFilter = searchParams.get("time"); // "upcoming" | "past" | "all"

    // Admins see all events; members see only published upcoming events
    let query = supabase
      .from("events")
      .select("*")
      .eq("club_id", result.member.club_id);

    if (!isAdmin) {
      query = query
        .eq("status", "published")
        .gte("start_date", new Date().toISOString())
        .order("start_date", { ascending: true });
    } else {
      // Admin time filter
      const now = new Date().toISOString();
      if (timeFilter === "past") {
        query = query.lt("start_date", now).order("start_date", { ascending: false });
      } else if (timeFilter === "all") {
        query = query.order("start_date", { ascending: false });
      } else {
        // Default: upcoming
        query = query.gte("start_date", now).order("start_date", { ascending: true });
      }
    }

    const { data: events, error } = await query;

    if (error) {
      console.error("Events query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch events" },
        { status: 500 }
      );
    }

    // For each event, get RSVP count and current user's RSVP
    const eventsWithRsvp: EventWithRsvp[] = await Promise.all(
      (events ?? []).map(async (event) => {
        // Count attending RSVPs
        const { count } = await supabase
          .from("event_rsvps")
          .select("*", { count: "exact", head: true })
          .eq("event_id", event.id)
          .eq("status", "attending");

        // Get current user's RSVP
        const { data: userRsvp } = await supabase
          .from("event_rsvps")
          .select("status")
          .eq("event_id", event.id)
          .eq("member_id", result.member.id)
          .maybeSingle();

        return {
          ...event,
          rsvp_count: count ?? 0,
          user_rsvp_status: (userRsvp?.status as RsvpStatus) ?? null,
        };
      })
    );

    return NextResponse.json({ events: eventsWithRsvp, role: result.member.role });
  } catch (error) {
    console.error("Events API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

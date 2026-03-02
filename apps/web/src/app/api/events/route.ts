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

    // Fetch upcoming published events for this club
    const { data: events, error } = await supabase
      .from("events")
      .select("*")
      .eq("club_id", result.member.club_id)
      .eq("status", "published")
      .gte("start_date", new Date().toISOString())
      .order("start_date", { ascending: true });

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

    return NextResponse.json({ events: eventsWithRsvp });
  } catch (error) {
    console.error("Events API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

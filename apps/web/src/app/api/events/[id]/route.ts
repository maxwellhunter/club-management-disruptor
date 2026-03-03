import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import type { EventWithRsvp, RsvpStatus } from "@club/shared";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: eventId } = await params;
    const isAdmin = result.member.role === "admin";

    // Build query scoped to member's club
    let query = supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .eq("club_id", result.member.club_id);

    // Non-admins can only see published events
    if (!isAdmin) {
      query = query.eq("status", "published");
    }

    const { data: event, error } = await query.single();

    if (error || !event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    // Enrich with RSVP count
    const { count } = await supabase
      .from("event_rsvps")
      .select("*", { count: "exact", head: true })
      .eq("event_id", event.id)
      .eq("status", "attending");

    // Get current user's RSVP status
    const { data: userRsvp } = await supabase
      .from("event_rsvps")
      .select("status")
      .eq("event_id", event.id)
      .eq("member_id", result.member.id)
      .maybeSingle();

    const eventWithRsvp: EventWithRsvp = {
      ...event,
      rsvp_count: count ?? 0,
      user_rsvp_status: (userRsvp?.status as RsvpStatus) ?? null,
    };

    return NextResponse.json({
      event: eventWithRsvp,
      role: result.member.role,
    });
  } catch (error) {
    console.error("Event detail API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

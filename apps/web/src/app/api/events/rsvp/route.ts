import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { rsvpSchema } from "@club/shared";

export async function POST(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Validate input
    const parsed = rsvpSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { event_id, status, guest_count } = parsed.data;

    // Get member
    const result = await getMemberWithTier(supabase, user.id);
    if (!result) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Check event exists and is published
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", event_id)
      .eq("club_id", result.member.club_id)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    if (event.status !== "published") {
      return NextResponse.json(
        { error: "This event is not accepting RSVPs" },
        { status: 400 }
      );
    }

    // Check event hasn't passed
    if (new Date(event.start_date) < new Date()) {
      return NextResponse.json(
        { error: "This event has already started" },
        { status: 400 }
      );
    }

    // If attending, check capacity
    if (status === "attending" && event.capacity) {
      const { count } = await supabase
        .from("event_rsvps")
        .select("*", { count: "exact", head: true })
        .eq("event_id", event_id)
        .eq("status", "attending")
        .neq("member_id", result.member.id); // Exclude current user's existing RSVP

      const totalAttending = (count ?? 0) + 1 + guest_count;
      if (totalAttending > event.capacity) {
        return NextResponse.json(
          { error: "This event is at capacity" },
          { status: 409 }
        );
      }
    }

    // Upsert RSVP (unique constraint on event_id + member_id)
    const { data: rsvp, error: rsvpError } = await supabase
      .from("event_rsvps")
      .upsert(
        {
          event_id,
          member_id: result.member.id,
          status,
          guest_count,
        },
        { onConflict: "event_id,member_id" }
      )
      .select()
      .single();

    if (rsvpError) {
      console.error("RSVP upsert error:", rsvpError);
      return NextResponse.json(
        { error: "Failed to update RSVP" },
        { status: 500 }
      );
    }

    return NextResponse.json({ rsvp }, { status: 200 });
  } catch (error) {
    console.error("RSVP API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

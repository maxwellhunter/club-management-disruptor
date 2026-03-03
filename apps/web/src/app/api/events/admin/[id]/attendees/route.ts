import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import type { EventAttendee, RsvpStatus } from "@club/shared";

// Service role client for admin reads (joins across tables, bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    if (result.member.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { id: eventId } = await params;

    // Verify event belongs to admin's club (cross-tenant isolation)
    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("id")
      .eq("id", eventId)
      .eq("club_id", result.member.club_id)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    // Fetch RSVPs joined with member info
    const { data: rsvps, error: rsvpError } = await supabaseAdmin
      .from("event_rsvps")
      .select(
        `
        id,
        member_id,
        status,
        guest_count,
        created_at,
        members (
          first_name,
          last_name,
          email
        )
      `
      )
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    if (rsvpError) {
      console.error("Attendees query error:", rsvpError);
      return NextResponse.json(
        { error: "Failed to fetch attendees" },
        { status: 500 }
      );
    }

    // Transform to EventAttendee shape
    const attendees: EventAttendee[] = (rsvps ?? []).map(
      (rsvp: Record<string, unknown>) => {
        const member = rsvp.members as Record<string, string>;
        return {
          rsvp_id: rsvp.id as string,
          member_id: rsvp.member_id as string,
          first_name: member.first_name,
          last_name: member.last_name,
          email: member.email,
          status: rsvp.status as RsvpStatus,
          guest_count: rsvp.guest_count as number,
          rsvp_created_at: rsvp.created_at as string,
        };
      }
    );

    // Compute total headcount: attending members + their guests
    const total_guests = attendees
      .filter((a) => a.status === "attending")
      .reduce((sum, a) => sum + 1 + a.guest_count, 0);

    return NextResponse.json({
      attendees,
      event_id: eventId,
      total_guests,
    });
  } catch (error) {
    console.error("Attendees API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    if (result.member.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { id: eventId } = await params;
    const body = await request.json();
    const rsvpId = body.rsvp_id;

    if (!rsvpId) {
      return NextResponse.json(
        { error: "rsvp_id is required" },
        { status: 400 }
      );
    }

    // Verify event belongs to admin's club (cross-tenant isolation)
    const { data: event, error: eventError } = await supabaseAdmin
      .from("events")
      .select("id")
      .eq("id", eventId)
      .eq("club_id", result.member.club_id)
      .single();

    if (eventError || !event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    // Delete the RSVP — scoped to both event and rsvp ID for safety
    const { error: deleteError } = await supabaseAdmin
      .from("event_rsvps")
      .delete()
      .eq("id", rsvpId)
      .eq("event_id", eventId);

    if (deleteError) {
      console.error("Remove attendee error:", deleteError);
      return NextResponse.json(
        { error: "Failed to remove attendee" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove attendee API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

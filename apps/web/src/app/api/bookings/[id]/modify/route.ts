import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { modifyBookingSchema } from "@club/shared";

export async function PATCH(
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

    const { id: bookingId } = await params;
    const body = await request.json();

    // Validate input
    const parsed = modifyBookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const changes = parsed.data;

    // Must have at least one field to change
    if (Object.keys(changes).length === 0) {
      return NextResponse.json(
        { error: "No changes provided" },
        { status: 400 }
      );
    }

    // Get the member
    const result = await getMemberWithTier(supabase, user.id);
    if (!result) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Fetch the existing booking
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("id, member_id, facility_id, date, start_time, end_time, status, party_size, club_id")
      .eq("id", bookingId)
      .eq("club_id", result.member.club_id)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    // Verify ownership (or admin)
    if (
      booking.member_id !== result.member.id &&
      result.member.role !== "admin"
    ) {
      return NextResponse.json(
        { error: "You can only modify your own bookings" },
        { status: 403 }
      );
    }

    // Check booking is modifiable
    if (booking.status !== "confirmed" && booking.status !== "pending") {
      return NextResponse.json(
        { error: "This booking cannot be modified" },
        { status: 400 }
      );
    }

    // Check booking is in the future
    const today = new Date().toISOString().split("T")[0];
    if (booking.date < today) {
      return NextResponse.json(
        { error: "Cannot modify past bookings" },
        { status: 400 }
      );
    }

    // If changing date/time, check the new slot is available
    const newDate = changes.date ?? booking.date;
    const newStartTime = changes.start_time ?? booking.start_time.substring(0, 5);

    if (changes.date || changes.start_time) {
      // Verify the new date is in the future
      if (newDate < today) {
        return NextResponse.json(
          { error: "Cannot move booking to a past date" },
          { status: 400 }
        );
      }

      // Verify a booking slot exists for the new day/time
      const dayOfWeek = new Date(newDate + "T12:00:00").getDay();
      const { data: slot } = await supabase
        .from("booking_slots")
        .select("id, end_time")
        .eq("facility_id", booking.facility_id)
        .eq("day_of_week", dayOfWeek)
        .eq("start_time", newStartTime + ":00")
        .eq("is_active", true)
        .maybeSingle();

      if (!slot) {
        return NextResponse.json(
          { error: "No available slot at that date/time" },
          { status: 400 }
        );
      }

      // If an end_time wasn't explicitly provided, use the slot's end_time
      if (!changes.end_time) {
        changes.end_time = slot.end_time.substring(0, 5);
      }

      // Check for double-booking (exclude the current booking)
      const { data: conflict } = await supabase
        .from("bookings")
        .select("id")
        .eq("facility_id", booking.facility_id)
        .eq("date", newDate)
        .eq("start_time", newStartTime + ":00")
        .eq("club_id", result.member.club_id)
        .in("status", ["confirmed", "pending"])
        .neq("id", bookingId)
        .maybeSingle();

      if (conflict) {
        return NextResponse.json(
          { error: "That tee time is already booked" },
          { status: 409 }
        );
      }
    }

    // Build the update object
    const updateData: Record<string, string | number> = {};
    if (changes.date) updateData.date = changes.date;
    if (changes.start_time) updateData.start_time = changes.start_time;
    if (changes.end_time) updateData.end_time = changes.end_time;
    if (changes.party_size) updateData.party_size = changes.party_size;
    if (changes.notes !== undefined) updateData.notes = changes.notes;

    const { data: updated, error: updateError } = await supabase
      .from("bookings")
      .update(updateData)
      .eq("id", bookingId)
      .select()
      .single();

    if (updateError) {
      console.error("Modify booking error:", updateError);
      return NextResponse.json(
        { error: "Failed to modify booking" },
        { status: 500 }
      );
    }

    return NextResponse.json({ booking: updated });
  } catch (error) {
    console.error("Modify booking API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

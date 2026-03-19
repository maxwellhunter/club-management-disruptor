import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";

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

    // Get the member
    const result = await getMemberWithTier(supabase, user.id);
    if (!result) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Fetch the booking (include facility_id and start_time for waitlist promotion)
    const { data: booking, error: fetchError } = await supabase
      .from("bookings")
      .select("id, member_id, facility_id, date, start_time, end_time, status")
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
        { error: "You can only cancel your own bookings" },
        { status: 403 }
      );
    }

    // Check booking is cancellable
    if (booking.status !== "confirmed" && booking.status !== "pending") {
      return NextResponse.json(
        { error: "This booking cannot be cancelled" },
        { status: 400 }
      );
    }

    // Check booking is in the future
    const today = new Date().toISOString().split("T")[0];
    if (booking.date < today) {
      return NextResponse.json(
        { error: "Cannot cancel past bookings" },
        { status: 400 }
      );
    }

    // Cancel the booking
    const { data: updated, error: updateError } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", bookingId)
      .select()
      .single();

    if (updateError) {
      console.error("Cancel booking error:", updateError);
      return NextResponse.json(
        { error: "Failed to cancel booking" },
        { status: 500 }
      );
    }

    // === Auto-promote first person on waitlist ===
    let promoted = null;
    try {
      const { data: nextInLine } = await supabase
        .from("booking_waitlist")
        .select("id, member_id, party_size, end_time")
        .eq("facility_id", booking.facility_id)
        .eq("date", booking.date)
        .eq("start_time", booking.start_time)
        .eq("status", "waiting")
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextInLine) {
        // Create a new booking for the promoted member
        const { data: newBooking, error: bookError } = await supabase
          .from("bookings")
          .insert({
            club_id: result.member.club_id,
            facility_id: booking.facility_id,
            member_id: nextInLine.member_id,
            date: booking.date,
            start_time: booking.start_time,
            end_time: nextInLine.end_time || booking.end_time,
            party_size: nextInLine.party_size,
            status: "confirmed",
            notes: "Auto-promoted from waitlist",
          })
          .select()
          .single();

        if (!bookError && newBooking) {
          // Mark waitlist entry as promoted
          await supabase
            .from("booking_waitlist")
            .update({ status: "promoted", notified_at: new Date().toISOString() })
            .eq("id", nextInLine.id);

          // Reorder remaining waitlist positions
          const { data: remaining } = await supabase
            .from("booking_waitlist")
            .select("id")
            .eq("facility_id", booking.facility_id)
            .eq("date", booking.date)
            .eq("start_time", booking.start_time)
            .eq("status", "waiting")
            .order("position", { ascending: true });

          if (remaining) {
            for (let i = 0; i < remaining.length; i++) {
              await supabase
                .from("booking_waitlist")
                .update({ position: i + 1 })
                .eq("id", remaining[i].id);
            }
          }

          promoted = {
            member_id: nextInLine.member_id,
            booking_id: newBooking.id,
          };
        }
      }
    } catch (promoteError) {
      // Log but don't fail the cancellation if promotion fails
      console.error("Waitlist promotion error:", promoteError);
    }

    return NextResponse.json({ booking: updated, waitlist_promoted: promoted });
  } catch (error) {
    console.error("Cancel booking API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

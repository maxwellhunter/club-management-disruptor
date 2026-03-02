import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import type { TeeTimeSlot } from "@club/shared";

export async function GET(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get("facility_id");
    const date = searchParams.get("date");

    if (!facilityId || !date) {
      return NextResponse.json(
        { error: "facility_id and date are required" },
        { status: 400 }
      );
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    // Check golf eligibility
    const result = await getMemberWithTier(supabase, user.id);
    if (!result) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    if (!result.isGolfEligible) {
      return NextResponse.json(
        { error: "Golf booking requires a Golf, Platinum, or Legacy membership" },
        { status: 403 }
      );
    }

    // Get the facility
    const { data: facility } = await supabase
      .from("facilities")
      .select("id, name, type, description")
      .eq("id", facilityId)
      .single();

    if (!facility) {
      return NextResponse.json(
        { error: "Facility not found" },
        { status: 404 }
      );
    }

    // Compute day_of_week (JS: 0=Sunday, matches Postgres convention)
    const dayOfWeek = new Date(date + "T12:00:00").getDay();

    // Get booking slots for this facility and day of week
    const { data: slots } = await supabase
      .from("booking_slots")
      .select("id, start_time, end_time")
      .eq("facility_id", facilityId)
      .eq("day_of_week", dayOfWeek)
      .eq("is_active", true)
      .order("start_time", { ascending: true });

    // Get existing bookings for this facility on this date
    const { data: existingBookings } = await supabase
      .from("bookings")
      .select("id, start_time")
      .eq("facility_id", facilityId)
      .eq("date", date)
      .in("status", ["confirmed", "pending"]);

    // Build a set of booked start times for fast lookup
    const bookedTimes = new Map<string, string>();
    if (existingBookings) {
      for (const booking of existingBookings) {
        // Supabase returns TIME as "HH:MM:SS", normalize to "HH:MM"
        const timeKey = booking.start_time.substring(0, 5);
        bookedTimes.set(timeKey, booking.id);
      }
    }

    // Merge slots with booking data
    const teeTimeSlots: TeeTimeSlot[] = (slots ?? []).map((slot) => {
      const startKey = slot.start_time.substring(0, 5);
      const bookingId = bookedTimes.get(startKey);
      return {
        start_time: startKey,
        end_time: slot.end_time.substring(0, 5),
        is_available: !bookingId,
        booking_id: bookingId,
      };
    });

    return NextResponse.json({
      facility,
      date,
      day_of_week: dayOfWeek,
      slots: teeTimeSlots,
    });
  } catch (error) {
    console.error("Tee times API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

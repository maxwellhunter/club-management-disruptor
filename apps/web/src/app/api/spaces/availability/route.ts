import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";

/**
 * GET /api/spaces/availability?facility_id=...&date=YYYY-MM-DD
 * Returns the slots configured for a non-golf space on the given date,
 * along with availability info (respects booking_slots.max_bookings).
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

    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get("facility_id");
    const date = searchParams.get("date");

    if (!facilityId || !date) {
      return NextResponse.json(
        { error: "facility_id and date are required" },
        { status: 400 }
      );
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const result = await getMemberWithTier(supabase, user.id);
    if (!result) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    const { data: facility } = await supabase
      .from("facilities")
      .select("id, name, type, description, image_url, capacity, max_party_size")
      .eq("id", facilityId)
      .eq("club_id", result.member.club_id)
      .eq("is_active", true)
      .single();

    if (!facility) {
      return NextResponse.json(
        { error: "Facility not found" },
        { status: 404 }
      );
    }

    const dayOfWeek = new Date(date + "T12:00:00").getDay();

    const { data: slots } = await supabase
      .from("booking_slots")
      .select("id, start_time, end_time, max_bookings")
      .eq("facility_id", facilityId)
      .eq("day_of_week", dayOfWeek)
      .eq("is_active", true)
      .order("start_time", { ascending: true });

    const { data: existingBookings } = await supabase
      .from("bookings")
      .select("id, start_time, member_id")
      .eq("facility_id", facilityId)
      .eq("date", date)
      .eq("club_id", result.member.club_id)
      .in("status", ["confirmed", "pending"]);

    // Count bookings and track whether current member has one per slot start
    const bookedCounts = new Map<string, number>();
    const memberBookingIds = new Map<string, string>();
    for (const b of existingBookings ?? []) {
      const key = b.start_time.substring(0, 5);
      bookedCounts.set(key, (bookedCounts.get(key) ?? 0) + 1);
      if (b.member_id === result.member.id) {
        memberBookingIds.set(key, b.id);
      }
    }

    const merged = (slots ?? []).map((slot) => {
      const startKey = slot.start_time.substring(0, 5);
      const booked = bookedCounts.get(startKey) ?? 0;
      return {
        start_time: startKey,
        end_time: slot.end_time.substring(0, 5),
        max_bookings: slot.max_bookings,
        booked_count: booked,
        is_available: booked < slot.max_bookings,
        my_booking_id: memberBookingIds.get(startKey) ?? null,
      };
    });

    return NextResponse.json({
      facility,
      date,
      day_of_week: dayOfWeek,
      slots: merged,
    });
  } catch (error) {
    console.error("Spaces availability API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import type { DiningSlot } from "@club/shared";

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

    const { searchParams } = new URL(request.url);
    const facility_id = searchParams.get("facility_id");
    const date = searchParams.get("date");

    if (!facility_id || !date) {
      return NextResponse.json(
        { error: "facility_id and date are required" },
        { status: 400 }
      );
    }

    // Verify facility belongs to user's club and is dining type
    const { data: facility } = await supabase
      .from("facilities")
      .select("id, type, name")
      .eq("id", facility_id)
      .eq("club_id", result.member.club_id)
      .eq("type", "dining")
      .eq("is_active", true)
      .single();

    if (!facility) {
      return NextResponse.json(
        { error: "Dining facility not found" },
        { status: 404 }
      );
    }

    // Get day of week for the requested date
    const dayOfWeek = new Date(date + "T12:00:00").getDay();

    // Get all booking slots for this facility + day
    const { data: bookingSlots } = await supabase
      .from("booking_slots")
      .select("start_time, end_time, max_bookings")
      .eq("facility_id", facility_id)
      .eq("day_of_week", dayOfWeek)
      .eq("is_active", true)
      .order("start_time", { ascending: true });

    if (!bookingSlots || bookingSlots.length === 0) {
      return NextResponse.json({ slots: [] });
    }

    // Get existing bookings for this facility + date
    const { data: existingBookings } = await supabase
      .from("bookings")
      .select("start_time")
      .eq("facility_id", facility_id)
      .eq("date", date)
      .eq("club_id", result.member.club_id)
      .in("status", ["confirmed", "pending"]);

    // Count bookings per time slot
    const bookingCounts: Record<string, number> = {};
    for (const b of existingBookings ?? []) {
      const t = b.start_time as string;
      bookingCounts[t] = (bookingCounts[t] || 0) + 1;
    }

    // Build availability
    const slots: DiningSlot[] = bookingSlots.map((slot) => {
      const t = slot.start_time as string;
      const count = bookingCounts[t] || 0;
      const remaining = (slot.max_bookings as number) - count;
      return {
        start_time: t.slice(0, 5), // "HH:MM"
        end_time: (slot.end_time as string).slice(0, 5),
        is_available: remaining > 0,
        bookings_remaining: Math.max(0, remaining),
      };
    });

    return NextResponse.json({ slots });
  } catch (error) {
    console.error("Dining availability error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

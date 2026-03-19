import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { scheduleConfigSchema } from "@club/shared";

/**
 * GET /api/bookings/admin/schedule?facility_id=...
 * Returns all booking_slots for a facility, grouped by day_of_week.
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

    const result = await getMemberWithTier(supabase, user.id);
    if (!result) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    if (result.member.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get("facility_id");

    if (!facilityId) {
      return NextResponse.json(
        { error: "facility_id is required" },
        { status: 400 }
      );
    }

    // Verify facility belongs to admin's club
    const { data: facility } = await supabase
      .from("facilities")
      .select("id, name, type")
      .eq("id", facilityId)
      .eq("club_id", result.member.club_id)
      .single();

    if (!facility) {
      return NextResponse.json(
        { error: "Facility not found" },
        { status: 404 }
      );
    }

    const { data: slots, error } = await supabase
      .from("booking_slots")
      .select("id, day_of_week, start_time, end_time, max_bookings, is_active")
      .eq("facility_id", facilityId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      console.error("Schedule fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch schedule" },
        { status: 500 }
      );
    }

    return NextResponse.json({ facility, slots: slots ?? [] });
  } catch (error) {
    console.error("Schedule API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bookings/admin/schedule
 * Generates booking slots from a schedule config.
 * Replaces existing slots for the given facility + days.
 */
export async function POST(request: Request) {
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
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = scheduleConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const {
      facility_id,
      days_of_week,
      start_time,
      end_time,
      interval_minutes,
      max_bookings,
    } = parsed.data;

    // Verify facility belongs to admin's club
    const { data: facility } = await supabase
      .from("facilities")
      .select("id, name")
      .eq("id", facility_id)
      .eq("club_id", result.member.club_id)
      .single();

    if (!facility) {
      return NextResponse.json(
        { error: "Facility not found" },
        { status: 404 }
      );
    }

    // Delete existing slots for these days
    const { error: deleteError } = await supabase
      .from("booking_slots")
      .delete()
      .eq("facility_id", facility_id)
      .in("day_of_week", days_of_week);

    if (deleteError) {
      console.error("Schedule delete error:", deleteError);
      return NextResponse.json(
        { error: "Failed to clear existing schedule" },
        { status: 500 }
      );
    }

    // Generate new slots
    const slots: {
      facility_id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
      max_bookings: number;
      is_active: boolean;
    }[] = [];

    const [startH, startM] = start_time.split(":").map(Number);
    const [endH, endM] = end_time.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    for (const dow of days_of_week) {
      let current = startMinutes;
      while (current + interval_minutes <= endMinutes) {
        const slotStart = `${String(Math.floor(current / 60)).padStart(2, "0")}:${String(current % 60).padStart(2, "0")}`;
        const slotEnd = `${String(Math.floor((current + interval_minutes) / 60)).padStart(2, "0")}:${String((current + interval_minutes) % 60).padStart(2, "0")}`;
        slots.push({
          facility_id,
          day_of_week: dow,
          start_time: slotStart,
          end_time: slotEnd,
          max_bookings,
          is_active: true,
        });
        current += interval_minutes;
      }
    }

    if (slots.length === 0) {
      return NextResponse.json(
        { error: "No slots to generate — check your time range and interval" },
        { status: 400 }
      );
    }

    const { error: insertError } = await supabase
      .from("booking_slots")
      .insert(slots);

    if (insertError) {
      console.error("Schedule insert error:", insertError);
      return NextResponse.json(
        { error: "Failed to generate schedule" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: `Generated ${slots.length} slots for ${days_of_week.length} day(s)`,
        count: slots.length,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Schedule API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bookings/admin/schedule?facility_id=...&day_of_week=...
 * Clears all slots for a facility on specific days (or all days if omitted).
 */
export async function DELETE(request: Request) {
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
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const facilityId = searchParams.get("facility_id");
    const dayParam = searchParams.get("day_of_week");

    if (!facilityId) {
      return NextResponse.json(
        { error: "facility_id is required" },
        { status: 400 }
      );
    }

    // Verify facility belongs to admin's club
    const { data: facility } = await supabase
      .from("facilities")
      .select("id")
      .eq("id", facilityId)
      .eq("club_id", result.member.club_id)
      .single();

    if (!facility) {
      return NextResponse.json(
        { error: "Facility not found" },
        { status: 404 }
      );
    }

    let query = supabase
      .from("booking_slots")
      .delete()
      .eq("facility_id", facilityId);

    if (dayParam !== null) {
      const days = dayParam.split(",").map(Number);
      query = query.in("day_of_week", days);
    }

    const { error } = await query;

    if (error) {
      console.error("Schedule delete error:", error);
      return NextResponse.json(
        { error: "Failed to delete schedule" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Schedule cleared" });
  } catch (error) {
    console.error("Schedule API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

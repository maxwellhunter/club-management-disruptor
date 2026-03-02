import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { createBookingSchema } from "@club/shared";

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
    const parsed = createBookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { facility_id, date, start_time, end_time, party_size, notes } =
      parsed.data;

    // Check golf eligibility
    const result = await getMemberWithTier(supabase, user.id);
    if (!result) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Check if facility is a golf course
    const { data: facility } = await supabase
      .from("facilities")
      .select("id, type")
      .eq("id", facility_id)
      .single();

    if (!facility) {
      return NextResponse.json(
        { error: "Facility not found" },
        { status: 404 }
      );
    }

    // Golf-specific checks
    if (facility.type === "golf") {
      if (!result.isGolfEligible) {
        return NextResponse.json(
          {
            error:
              "Golf booking requires a Golf, Platinum, or Legacy membership",
          },
          { status: 403 }
        );
      }

      if (party_size > 4) {
        return NextResponse.json(
          { error: "Golf tee times support a maximum of 4 players" },
          { status: 400 }
        );
      }
    }

    // Double-booking prevention: check if slot is already taken
    const { data: existingBooking } = await supabase
      .from("bookings")
      .select("id")
      .eq("facility_id", facility_id)
      .eq("date", date)
      .eq("start_time", start_time)
      .in("status", ["confirmed", "pending"])
      .maybeSingle();

    if (existingBooking) {
      return NextResponse.json(
        { error: "This tee time is already booked" },
        { status: 409 }
      );
    }

    // Create the booking
    const { data: booking, error } = await supabase
      .from("bookings")
      .insert({
        club_id: result.member.club_id,
        facility_id,
        member_id: result.member.id,
        date,
        start_time,
        end_time,
        party_size,
        notes: notes ?? null,
        status: "confirmed",
      })
      .select()
      .single();

    if (error) {
      console.error("Booking insert error:", error);
      return NextResponse.json(
        { error: "Failed to create booking" },
        { status: 500 }
      );
    }

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    console.error("Booking API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

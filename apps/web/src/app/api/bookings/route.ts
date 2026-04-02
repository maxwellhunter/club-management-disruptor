import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { createBookingSchema } from "@club/shared";
import { sendBookingConfirmationEmail } from "@/lib/email";

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
      .eq("club_id", result.member.club_id)
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

    // Double-booking prevention
    if (facility.type === "dining") {
      // Dining: multiple bookings allowed per slot up to max_bookings
      const dayOfWeek = new Date(date + "T12:00:00").getDay();
      const { data: slot } = await supabase
        .from("booking_slots")
        .select("max_bookings")
        .eq("facility_id", facility_id)
        .eq("day_of_week", dayOfWeek)
        .eq("start_time", start_time)
        .eq("is_active", true)
        .maybeSingle();

      const maxBookings = slot?.max_bookings ?? 1;

      const { count } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("facility_id", facility_id)
        .eq("date", date)
        .eq("start_time", start_time)
        .eq("club_id", result.member.club_id)
        .in("status", ["confirmed", "pending"]);

      if ((count ?? 0) >= maxBookings) {
        return NextResponse.json(
          { error: "This dining time slot is fully booked" },
          { status: 409 }
        );
      }
    } else {
      // Golf/tennis/etc: single booking per slot
      const { data: existingBooking } = await supabase
        .from("bookings")
        .select("id")
        .eq("facility_id", facility_id)
        .eq("date", date)
        .eq("start_time", start_time)
        .eq("club_id", result.member.club_id)
        .in("status", ["confirmed", "pending"])
        .maybeSingle();

      if (existingBooking) {
        return NextResponse.json(
          { error: "This tee time is already booked" },
          { status: 409 }
        );
      }
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

    // Send confirmation email (fire-and-forget)
    const { data: facilityDetails } = await supabase
      .from("facilities")
      .select("name")
      .eq("id", facility_id)
      .single();

    const { data: club } = await supabase
      .from("clubs")
      .select("name")
      .eq("id", result.member.club_id)
      .single();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    sendBookingConfirmationEmail({
      to: result.member.email,
      memberName: result.member.first_name,
      clubName: club?.name ?? "Your Club",
      facilityName: facilityDetails?.name ?? "Facility",
      date,
      startTime: start_time,
      partySize: party_size,
      dashboardUrl: baseUrl,
    }).catch((err) => console.error("[email] Booking confirmation failed:", err));

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error) {
    console.error("Booking API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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
    const type = searchParams.get("type");
    const today = new Date().toISOString().split("T")[0];

    let query = supabase
      .from("bookings")
      .select(
        `id, club_id, facility_id, member_id, date, start_time, end_time, status, party_size, notes, created_at, updated_at, facilities(name, type), members(first_name, last_name)`
      )
      .eq("club_id", result.member.club_id)
      .gte("date", today)
      .in("status", ["confirmed", "pending"])
      .order("date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(100);

    const { data: bookings, error } = await query;

    if (error) {
      console.error("Admin bookings query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch bookings" },
        { status: 500 }
      );
    }

    let bookingsWithDetails = (bookings ?? []).map((b) => {
      const facility = b.facilities as unknown as {
        name: string;
        type: string;
      } | null;
      const member = b.members as unknown as {
        first_name: string;
        last_name: string;
      } | null;
      return {
        id: b.id,
        club_id: b.club_id,
        facility_id: b.facility_id,
        member_id: b.member_id,
        date: b.date,
        start_time: b.start_time.substring(0, 5),
        end_time: b.end_time.substring(0, 5),
        status: b.status,
        party_size: b.party_size,
        notes: b.notes,
        created_at: b.created_at,
        updated_at: b.updated_at,
        facility_name: facility?.name ?? "Unknown",
        facility_type: facility?.type ?? "other",
        member_first_name: member?.first_name ?? "",
        member_last_name: member?.last_name ?? "",
      };
    });

    if (type) {
      bookingsWithDetails = bookingsWithDetails.filter(
        (b) => b.facility_type === type
      );
    }

    return NextResponse.json({ bookings: bookingsWithDetails });
  } catch (error) {
    console.error("Admin bookings API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";

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

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split("T")[0];

    // Query upcoming bookings with facility details
    const { data: bookings, error } = await supabase
      .from("bookings")
      .select(
        `
        id,
        club_id,
        facility_id,
        member_id,
        date,
        start_time,
        end_time,
        status,
        party_size,
        notes,
        created_at,
        updated_at,
        facilities (
          name,
          type
        )
      `
      )
      .eq("member_id", result.member.id)
      .gte("date", today)
      .in("status", ["confirmed", "pending"])
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      console.error("My bookings query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch bookings" },
        { status: 500 }
      );
    }

    // Transform to BookingWithDetails shape
    const bookingsWithDetails = (bookings ?? []).map((b) => {
      const facility = b.facilities as unknown as {
        name: string;
        type: string;
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
        member_first_name: result.member.first_name,
        member_last_name: result.member.last_name,
      };
    });

    return NextResponse.json({ bookings: bookingsWithDetails });
  } catch (error) {
    console.error("My bookings API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

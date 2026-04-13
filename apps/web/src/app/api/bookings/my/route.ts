import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

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

    const memberId = result.member.id;
    const today = new Date().toISOString().split("T")[0];

    // Optional facility type filter (e.g. ?type=golf)
    const { searchParams } = new URL(request.url);
    const facilityType = searchParams.get("type");

    // 1. Bookings I created
    let ownQuery = supabase
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
        facilities!inner (
          name,
          type
        )
      `
      )
      .eq("member_id", memberId)
      .gte("date", today)
      .in("status", ["confirmed", "pending"])
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });

    if (facilityType) {
      ownQuery = ownQuery.eq("facilities.type", facilityType);
    }

    const { data: ownBookings, error: ownError } = await ownQuery;

    if (ownError) {
      console.error("My bookings query error:", ownError);
      return NextResponse.json(
        { error: "Failed to fetch bookings" },
        { status: 500 }
      );
    }

    // 2. Bookings I'm added to as a player (but didn't create)
    const admin = getSupabaseAdmin();
    const { data: playerEntries } = await admin
      .from("booking_players")
      .select("booking_id")
      .eq("member_id", memberId);

    const playerBookingIds = (playerEntries ?? [])
      .map((p) => p.booking_id)
      .filter(
        (bid: string) => !(ownBookings ?? []).some((b) => b.id === bid)
      );

    let invitedBookings: typeof ownBookings = [];
    if (playerBookingIds.length > 0) {
      let invitedQuery = admin
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
          facilities!inner (
            name,
            type
          )
        `
        )
        .in("id", playerBookingIds)
        .gte("date", today)
        .in("status", ["confirmed", "pending"])
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (facilityType) {
        invitedQuery = invitedQuery.eq("facilities.type", facilityType);
      }

      const { data } = await invitedQuery;

      invitedBookings = data ?? [];
    }

    // Transform to BookingWithDetails shape, tagging ownership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function formatBooking(b: any, isOwner: boolean) {
      const facility = b.facilities as { name: string; type: string } | null;
      return {
        id: b.id,
        club_id: b.club_id,
        facility_id: b.facility_id,
        member_id: b.member_id,
        date: b.date,
        start_time: (b.start_time as string).substring(0, 5),
        end_time: (b.end_time as string).substring(0, 5),
        status: b.status,
        party_size: b.party_size,
        notes: b.notes,
        created_at: b.created_at,
        updated_at: b.updated_at,
        facility_name: facility?.name ?? "Unknown",
        facility_type: facility?.type ?? "other",
        member_first_name: result!.member.first_name,
        member_last_name: result!.member.last_name,
        is_owner: isOwner,
      };
    }

    const all = [
      ...(ownBookings ?? []).map((b) => formatBooking(b, true)),
      ...(invitedBookings ?? []).map((b) => formatBooking(b, false)),
    ].sort((a, b) => {
      const dateComp = a.date.localeCompare(b.date);
      if (dateComp !== 0) return dateComp;
      return a.start_time.localeCompare(b.start_time);
    });

    return NextResponse.json({ bookings: all });
  } catch (error) {
    console.error("My bookings API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { lookupPlayerRates, deriveDayType, deriveTimeType } from "@/lib/golf-rate-lookup";
import type { GolfHoles } from "@club/shared";

/**
 * POST /api/bookings/rate-lookup
 * Preview pricing for a tee time before booking.
 *
 * Body: {
 *   facility_id: string,
 *   date: string (YYYY-MM-DD),
 *   start_time: string (HH:MM),
 *   holes: "9" | "18",
 *   players: Array<{ player_type: "member"|"guest", member_id?: string, guest_name?: string }>
 * }
 *
 * Returns per-player pricing + total estimate.
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

    const body = await request.json();
    const { facility_id, date, start_time, holes, players } = body;

    if (!facility_id || !date || !start_time) {
      return NextResponse.json(
        { error: "facility_id, date, and start_time are required" },
        { status: 400 }
      );
    }

    const holesValue: GolfHoles = holes === "9" ? "9" : "18";

    // Always include the booking member as first player
    const bookerPlayer = {
      player_type: "member" as const,
      member_id: result.member.id,
      tier_id: result.member.membership_tier_id,
    };

    const additionalPlayers = (players ?? []).map(
      (p: { player_type: string; member_id?: string; guest_name?: string }) => ({
        player_type: p.player_type as "member" | "guest",
        member_id: p.member_id ?? null,
        guest_name: p.guest_name ?? null,
      })
    );

    const allPlayers = [bookerPlayer, ...additionalPlayers];

    const playerRates = await lookupPlayerRates(supabase, {
      facilityId: facility_id,
      clubId: result.member.club_id,
      date,
      startTime: start_time,
      holes: holesValue,
      players: allPlayers,
    });

    // Override booker display name
    if (playerRates.length > 0) {
      playerRates[0].display_name = `${result.member.first_name} ${result.member.last_name} (You)`;
      playerRates[0].tier_name = result.member.tier_name;
    }

    const total = playerRates.reduce((sum, p) => sum + p.total_fee, 0);

    return NextResponse.json({
      day_type: deriveDayType(date),
      time_type: deriveTimeType(start_time),
      holes: holesValue,
      players: playerRates,
      total,
    });
  } catch (error) {
    console.error("Rate lookup API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

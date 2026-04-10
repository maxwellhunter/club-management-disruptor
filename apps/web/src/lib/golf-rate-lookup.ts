import { SupabaseClient } from "@supabase/supabase-js";
import type { GolfDayType, GolfTimeType, GolfHoles } from "@club/shared";

/**
 * Derive day_type from a date string (YYYY-MM-DD).
 * Sat/Sun = weekend, else weekday.
 */
export function deriveDayType(dateStr: string): GolfDayType {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay(); // 0=Sun, 6=Sat
  return dow === 0 || dow === 6 ? "weekend" : "weekday";
}

/**
 * Derive time_type from a start_time string (HH:MM).
 * Before 12:00 = prime, 12:00-15:59 = afternoon, 16:00+ = twilight.
 */
export function deriveTimeType(startTime: string): GolfTimeType {
  const hour = parseInt(startTime.split(":")[0], 10);
  if (hour < 12) return "prime";
  if (hour < 16) return "afternoon";
  return "twilight";
}

export interface PlayerRateLookupInput {
  player_type: "member" | "guest";
  member_id?: string | null;
  tier_id?: string | null; // if already known
  guest_name?: string | null;
}

export interface PlayerRateResult {
  player_type: "member" | "guest";
  member_id: string | null;
  guest_name: string | null;
  display_name: string;
  tier_name: string | null;
  rate_id: string | null;
  greens_fee: number;
  cart_fee: number;
  caddie_fee: number;
  total_fee: number;
  rate_name: string | null;
}

/**
 * Look up player rates for a list of players given booking context.
 * Returns pricing for each player based on their tier (or guest status).
 */
export async function lookupPlayerRates(
  supabase: SupabaseClient,
  opts: {
    facilityId: string;
    clubId: string;
    date: string;
    startTime: string;
    holes: GolfHoles;
    players: PlayerRateLookupInput[];
  }
): Promise<PlayerRateResult[]> {
  const dayType = deriveDayType(opts.date);
  const timeType = deriveTimeType(opts.startTime);

  // Fetch ALL active rates for this facility/day/time/holes combo
  const { data: rates } = await supabase
    .from("golf_player_rates")
    .select("*")
    .eq("facility_id", opts.facilityId)
    .eq("club_id", opts.clubId)
    .eq("day_type", dayType)
    .eq("time_type", timeType)
    .eq("holes", opts.holes)
    .eq("is_active", true);

  const allRates = rates ?? [];

  // For members without a known tier_id, we need to look up their tier
  const memberIdsNeedingTier = opts.players
    .filter((p) => p.player_type === "member" && p.member_id && !p.tier_id)
    .map((p) => p.member_id!);

  const memberTierMap: Record<string, { tier_id: string | null; tier_name: string | null; first_name: string; last_name: string }> = {};

  if (memberIdsNeedingTier.length > 0) {
    const { data: members } = await supabase
      .from("members")
      .select("id, first_name, last_name, membership_tier_id, membership_tiers(name)")
      .in("id", memberIdsNeedingTier);

    for (const m of members ?? []) {
      const tier = m.membership_tiers as unknown as { name: string } | null;
      memberTierMap[m.id] = {
        tier_id: m.membership_tier_id,
        tier_name: tier?.name ?? null,
        first_name: m.first_name,
        last_name: m.last_name,
      };
    }
  }

  // Match each player to a rate
  return opts.players.map((player) => {
    if (player.player_type === "guest") {
      // Find guest rate (is_guest = true)
      const guestRate = allRates.find((r) => r.is_guest);
      return {
        player_type: "guest" as const,
        member_id: null,
        guest_name: player.guest_name ?? null,
        display_name: player.guest_name ?? "Guest",
        tier_name: null,
        rate_id: guestRate?.id ?? null,
        greens_fee: guestRate?.greens_fee ?? 0,
        cart_fee: guestRate?.cart_fee ?? 0,
        caddie_fee: guestRate?.caddie_fee ?? 0,
        total_fee: (guestRate?.greens_fee ?? 0) + (guestRate?.cart_fee ?? 0) + (guestRate?.caddie_fee ?? 0),
        rate_name: guestRate?.name ?? null,
      };
    }

    // Member — resolve tier
    const tierId = player.tier_id ?? memberTierMap[player.member_id!]?.tier_id ?? null;
    const tierName = memberTierMap[player.member_id!]?.tier_name ?? null;
    const firstName = memberTierMap[player.member_id!]?.first_name ?? "";
    const lastName = memberTierMap[player.member_id!]?.last_name ?? "";

    // Find rate matching this tier
    const memberRate = allRates.find(
      (r) => !r.is_guest && r.tier_id === tierId
    );

    return {
      player_type: "member" as const,
      member_id: player.member_id ?? null,
      guest_name: null,
      display_name: firstName && lastName ? `${firstName} ${lastName}` : "Member",
      tier_name: tierName,
      rate_id: memberRate?.id ?? null,
      greens_fee: memberRate?.greens_fee ?? 0,
      cart_fee: memberRate?.cart_fee ?? 0,
      caddie_fee: memberRate?.caddie_fee ?? 0,
      total_fee: (memberRate?.greens_fee ?? 0) + (memberRate?.cart_fee ?? 0) + (memberRate?.caddie_fee ?? 0),
      rate_name: memberRate?.name ?? null,
    };
  });
}

import { SupabaseClient } from "@supabase/supabase-js";
import { GOLF_ELIGIBLE_TIERS } from "@club/shared";
import type { MembershipTierLevel } from "@club/shared";

export interface MemberWithTier {
  id: string;
  club_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: "admin" | "staff" | "member";
  status: string;
  membership_tier_id: string | null;
  tier_level: MembershipTierLevel | null;
  tier_name: string | null;
}

export interface GolfEligibilityResult {
  member: MemberWithTier;
  isGolfEligible: boolean;
}

/**
 * Look up the current user's member record with tier info,
 * and determine whether they can book golf tee times.
 *
 * Golf-eligible: tier level is premium, vip, or honorary.
 * Admins and staff are always eligible (they manage bookings).
 */
export async function getMemberWithTier(
  supabase: SupabaseClient,
  userId: string
): Promise<GolfEligibilityResult | null> {
  const { data, error } = await supabase
    .from("members")
    .select(
      `
      id,
      club_id,
      user_id,
      first_name,
      last_name,
      email,
      role,
      status,
      membership_tier_id,
      membership_tiers (
        level,
        name
      )
    `
    )
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  const tier = data.membership_tiers as unknown as {
    level: MembershipTierLevel;
    name: string;
  } | null;

  const member: MemberWithTier = {
    id: data.id,
    club_id: data.club_id,
    user_id: data.user_id,
    first_name: data.first_name,
    last_name: data.last_name,
    email: data.email,
    role: data.role,
    status: data.status,
    membership_tier_id: data.membership_tier_id,
    tier_level: tier?.level ?? null,
    tier_name: tier?.name ?? null,
  };

  // Admins and staff are always golf-eligible
  const isGolfEligible =
    member.role === "admin" ||
    member.role === "staff" ||
    (member.tier_level !== null &&
      GOLF_ELIGIBLE_TIERS.includes(member.tier_level));

  return { member, isGolfEligible };
}

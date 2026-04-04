/**
 * Spending Tracker — Calculates member spending against tier minimums
 *
 * Queries POS transactions + dining orders + invoices with specific categories
 * to compute how much a member has spent in each category during a period.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SpendingCategory, SpendingMinimumPeriod } from "@club/shared";

interface PeriodBounds {
  start: string; // YYYY-MM-DD
  end: string;
}

/** Get the date bounds for a spending period ending on/before `asOf` */
export function getPeriodBounds(
  period: SpendingMinimumPeriod,
  asOf: Date = new Date()
): PeriodBounds {
  const year = asOf.getFullYear();
  const month = asOf.getMonth(); // 0-indexed

  switch (period) {
    case "monthly": {
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0); // Last day of month
      return {
        start: start.toISOString().split("T")[0],
        end: end.toISOString().split("T")[0],
      };
    }
    case "quarterly": {
      const qStart = Math.floor(month / 3) * 3;
      const start = new Date(year, qStart, 1);
      const end = new Date(year, qStart + 3, 0);
      return {
        start: start.toISOString().split("T")[0],
        end: end.toISOString().split("T")[0],
      };
    }
    case "annually": {
      return {
        start: `${year}-01-01`,
        end: `${year}-12-31`,
      };
    }
  }
}

/** Map spending categories to POS location filters */
const CATEGORY_POS_LOCATIONS: Record<SpendingCategory, string[]> = {
  dining: ["dining"],
  pro_shop: ["pro_shop"],
  bar: ["bar", "snack_bar"],
  total: ["dining", "pro_shop", "bar", "snack_bar", "other"],
};

/** Calculate total spending for a member in a category during a period */
export async function getMemberSpending(
  adminClient: SupabaseClient,
  clubId: string,
  memberId: string,
  category: SpendingCategory,
  periodStart: string,
  periodEnd: string
): Promise<number> {
  let total = 0;

  // 1. POS transactions (completed sales)
  const posLocations = CATEGORY_POS_LOCATIONS[category];
  const { data: posTxns } = await adminClient
    .from("pos_transactions")
    .select("total")
    .eq("club_id", clubId)
    .eq("member_id", memberId)
    .eq("status", "completed")
    .eq("type", "sale")
    .in("location", posLocations)
    .gte("created_at", `${periodStart}T00:00:00`)
    .lte("created_at", `${periodEnd}T23:59:59`);

  if (posTxns) {
    total += posTxns.reduce((sum, t) => sum + Number(t.total), 0);
  }

  // 2. Dining orders charged to member account (not through POS)
  if (category === "dining" || category === "total") {
    const { data: diningOrders } = await adminClient
      .from("dining_orders")
      .select("total")
      .eq("club_id", clubId)
      .eq("member_id", memberId)
      .in("status", ["delivered", "completed"])
      .gte("created_at", `${periodStart}T00:00:00`)
      .lte("created_at", `${periodEnd}T23:59:59`);

    if (diningOrders) {
      total += diningOrders.reduce((sum, o) => sum + Number(o.total), 0);
    }
  }

  return Math.round(total * 100) / 100;
}

/** Calculate spending for all members with active minimums */
export async function calculateAllSpendingTracking(
  adminClient: SupabaseClient,
  clubId: string,
  asOf: Date = new Date()
): Promise<{
  tracked: {
    member_id: string;
    minimum_id: string;
    period_start: string;
    period_end: string;
    amount_spent: number;
    amount_required: number;
    shortfall: number;
  }[];
  errors: string[];
}> {
  const errors: string[] = [];
  const tracked: {
    member_id: string;
    minimum_id: string;
    period_start: string;
    period_end: string;
    amount_spent: number;
    amount_required: number;
    shortfall: number;
  }[] = [];

  // Get all active spending minimums for this club
  const { data: minimums } = await adminClient
    .from("spending_minimums")
    .select("*, membership_tiers(id, name)")
    .eq("club_id", clubId)
    .eq("is_active", true);

  if (!minimums || minimums.length === 0) return { tracked, errors };

  // Get all active members with their tier
  const { data: members } = await adminClient
    .from("members")
    .select("id, membership_tier_id")
    .eq("club_id", clubId)
    .eq("status", "active");

  if (!members) return { tracked, errors };

  for (const minimum of minimums) {
    const { start, end } = getPeriodBounds(minimum.period as SpendingMinimumPeriod, asOf);

    // Find members in this tier
    const tierMembers = members.filter(
      (m) => m.membership_tier_id === minimum.tier_id
    );

    for (const member of tierMembers) {
      try {
        const spent = await getMemberSpending(
          adminClient,
          clubId,
          member.id,
          minimum.category as SpendingCategory,
          start,
          end
        );

        const shortfall = Math.max(0, Number(minimum.amount) - spent);

        tracked.push({
          member_id: member.id,
          minimum_id: minimum.id,
          period_start: start,
          period_end: end,
          amount_spent: spent,
          amount_required: Number(minimum.amount),
          shortfall,
        });
      } catch (err) {
        errors.push(
          `Error tracking spending for member ${member.id}: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    }
  }

  return { tracked, errors };
}

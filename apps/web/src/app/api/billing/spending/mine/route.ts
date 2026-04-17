import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";

/**
 * GET /api/billing/spending/mine — Returns the current member's
 * spending-minimum progress for any active tracking periods. Backs
 * the Home status strip and Billing dashboard. Response shape:
 *
 * {
 *   trackers: Array<{
 *     minimum_id: string
 *     name: string              // e.g. "F&B Minimum"
 *     category: string          // "dining" | "pro_shop" | ...
 *     period: string            // "monthly" | "quarterly" | "annual"
 *     period_start: string      // yyyy-MM-dd
 *     period_end: string
 *     amount_spent: number
 *     amount_required: number
 *     shortfall: number         // amount_required - amount_spent (clamped)
 *     enforce_shortfall: boolean
 *   }>
 * }
 *
 * Only returns trackers for periods that include today — historical
 * tracking rows are ignored so the Home UI always shows the "right now"
 * snapshot.
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

    const caller = await getMemberWithTier(supabase, user.id);
    if (!caller) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const today = new Date().toISOString().slice(0, 10); // yyyy-MM-dd

    const { data, error } = await adminClient
      .from("spending_tracking")
      .select(
        `
        minimum_id,
        period_start,
        period_end,
        amount_spent,
        amount_required,
        shortfall,
        spending_minimums (
          name,
          category,
          period,
          enforce_shortfall,
          is_active
        )
      `
      )
      .eq("club_id", caller.member.club_id)
      .eq("member_id", caller.member.id)
      .lte("period_start", today)
      .gte("period_end", today);

    if (error) {
      console.error("Spending/mine query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch spending progress" },
        { status: 500 }
      );
    }

    const trackers = (data ?? [])
      .map((row: any) => {
        const min = row.spending_minimums;
        if (!min?.is_active) return null;
        const amountSpent = Number(row.amount_spent) || 0;
        const amountRequired = Number(row.amount_required) || 0;
        return {
          minimum_id: row.minimum_id,
          name: min.name,
          category: min.category,
          period: min.period,
          period_start: row.period_start,
          period_end: row.period_end,
          amount_spent: amountSpent,
          amount_required: amountRequired,
          shortfall: Math.max(0, amountRequired - amountSpent),
          enforce_shortfall: !!min.enforce_shortfall,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ trackers });
  } catch (error) {
    console.error("Spending/mine GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

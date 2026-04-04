import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { runBillingCycleSchema } from "@club/shared";
import { runBillingCycle } from "@/lib/billing/billing-engine";

/**
 * POST /api/billing/cycles — Run a billing cycle
 */
export async function POST(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const caller = await getMemberWithTier(supabase, user.id);
    if (!caller || caller.member.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = runBillingCycleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { cycleId, result } = await runBillingCycle(
      adminClient,
      caller.member.club_id,
      input.type,
      input.period_start,
      input.period_end,
      caller.member.id,
      input.assessment_id
    );

    return NextResponse.json({
      cycle_id: cycleId,
      invoices_created: result.invoicesCreated,
      total_amount: result.totalAmount,
      errors: result.errors,
    }, { status: 201 });
  } catch (error) {
    console.error("Run billing cycle error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

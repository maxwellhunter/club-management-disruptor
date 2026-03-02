import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { createClient } from "@supabase/supabase-js";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { getSubscription } from "@/lib/stripe";
import type { BillingStatus } from "@club/shared";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    // Get stripe fields from members
    const { data: memberData } = await supabaseAdmin
      .from("members")
      .select("stripe_customer_id, stripe_subscription_id, subscription_status")
      .eq("id", result.member.id)
      .single();

    const hasStripeCustomer = !!memberData?.stripe_customer_id;
    let subscription: BillingStatus["subscription"] = null;

    // If they have a subscription, get details from Stripe
    if (memberData?.stripe_subscription_id && process.env.STRIPE_SECRET_KEY) {
      try {
        const sub = await getSubscription(memberData.stripe_subscription_id);
        const amount =
          sub.items.data[0]?.price?.unit_amount
            ? sub.items.data[0].price.unit_amount / 100
            : 0;

        subscription = {
          status: sub.status as BillingStatus["subscription"] extends null
            ? never
            : NonNullable<BillingStatus["subscription"]>["status"],
          currentPeriodEnd: new Date(
            sub.current_period_end * 1000
          ).toISOString(),
          cancelAtPeriodEnd: sub.cancel_at_period_end,
          amount,
          tierName: result.member.tier_name || "Unknown",
        };
      } catch (err) {
        console.error("Failed to fetch Stripe subscription:", err);
        // Return what we know from the DB
        if (memberData.subscription_status) {
          subscription = {
            status: memberData.subscription_status,
            currentPeriodEnd: "",
            cancelAtPeriodEnd: false,
            amount: 0,
            tierName: result.member.tier_name || "Unknown",
          };
        }
      }
    }

    // Get recent invoices from Supabase
    const { data: invoices } = await supabase
      .from("invoices")
      .select("*")
      .eq("member_id", result.member.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const billingStatus: BillingStatus = {
      role: result.member.role,
      tierName: result.member.tier_name,
      hasStripeCustomer,
      subscription,
      recentInvoices: invoices ?? [],
    };

    return NextResponse.json(billingStatus);
  } catch (error) {
    console.error("Billing status error:", error);
    return NextResponse.json(
      { error: "Failed to fetch billing status" },
      { status: 500 }
    );
  }
}

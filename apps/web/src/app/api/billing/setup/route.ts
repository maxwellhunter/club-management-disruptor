import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { createClient } from "@supabase/supabase-js";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { createStripeCustomer, createSubscriptionCheckout } from "@/lib/stripe";

// Service role client for writing stripe_customer_id (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "Stripe is not configured" },
        { status: 503 }
      );
    }

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

    // Look up the tier's stripe_price_id
    const { data: tier } = await supabase
      .from("membership_tiers")
      .select("stripe_price_id, name")
      .eq("id", result.member.membership_tier_id)
      .single();

    if (!tier?.stripe_price_id) {
      return NextResponse.json(
        { error: "No billing plan configured for your membership tier" },
        { status: 400 }
      );
    }

    // Get or create Stripe Customer
    let stripeCustomerId: string;

    // Check if member already has a stripe_customer_id
    const { data: memberData } = await supabaseAdmin
      .from("members")
      .select("stripe_customer_id")
      .eq("id", result.member.id)
      .single();

    if (memberData?.stripe_customer_id) {
      stripeCustomerId = memberData.stripe_customer_id;
    } else {
      // Create new Stripe Customer
      const customer = await createStripeCustomer({
        email: result.member.email,
        name: `${result.member.first_name} ${result.member.last_name}`,
        memberId: result.member.id,
        clubId: result.member.club_id,
      });
      stripeCustomerId = customer.id;

      // Save to DB
      await supabaseAdmin
        .from("members")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", result.member.id);
    }

    // Determine URLs for redirect
    const origin =
      request.headers.get("origin") || "http://localhost:3000";

    // Create Checkout Session
    const session = await createSubscriptionCheckout({
      customerId: stripeCustomerId,
      priceId: tier.stripe_price_id,
      successUrl: `${origin}/dashboard/billing?setup=success`,
      cancelUrl: `${origin}/dashboard/billing?setup=cancelled`,
      memberId: result.member.id,
    });

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (error) {
    console.error("Billing setup error:", error);
    return NextResponse.json(
      { error: "Failed to set up billing" },
      { status: 500 }
    );
  }
}

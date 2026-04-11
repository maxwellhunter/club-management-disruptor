import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import {
  createSetupIntent,
  savePaymentMethod,
  listPaymentMethods,
  removePaymentMethod,
} from "@/lib/stripe-payments";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/billing/payment-methods
 * List the current member's payment methods.
 * Admin can pass ?member_id=... to view another member's methods.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getMemberWithTier(supabase, user.id);
    if (!result) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const url = new URL(request.url);
    let targetMemberId = result.member.id;

    // Admin can view other members' payment methods
    const memberIdParam = url.searchParams.get("member_id");
    if (memberIdParam && memberIdParam !== result.member.id) {
      if (result.member.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      targetMemberId = memberIdParam;
    }

    const methods = await listPaymentMethods(supabase, targetMemberId);
    return NextResponse.json({ payment_methods: methods });
  } catch (error) {
    console.error("GET /api/billing/payment-methods error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/billing/payment-methods
 * Start adding a payment method (returns SetupIntent client_secret)
 * or confirm a completed setup (saves to DB).
 *
 * Body: { action: "setup", types?: ["us_bank_account", "card"] }
 *    or { action: "confirm", setup_intent_id: "seti_...", set_default?: boolean }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getMemberWithTier(supabase, user.id);
    if (!result) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const body = await request.json();
    const action = body.action;

    if (action === "setup") {
      // Look up Stripe customer ID (not on MemberWithTier interface)
      const { data: memberRecord } = await supabase
        .from("members")
        .select("stripe_customer_id")
        .eq("id", result.member.id)
        .single();

      let stripeCustomerId = memberRecord?.stripe_customer_id as string | null;
      if (!stripeCustomerId) {
        // Create Stripe customer on the fly
        const { createStripeCustomer } = await import("@/lib/stripe");
        const customer = await createStripeCustomer({
          email: result.member.email,
          name: `${result.member.first_name} ${result.member.last_name}`,
          memberId: result.member.id,
          clubId: result.member.club_id,
        });
        stripeCustomerId = customer.id;

        // Save to member record
        await getSupabaseAdmin()
          .from("members")
          .update({ stripe_customer_id: customer.id })
          .eq("id", result.member.id);
      }

      const types = body.types ?? ["us_bank_account", "card"];
      const setupIntent = await createSetupIntent(stripeCustomerId, types);

      return NextResponse.json({
        client_secret: setupIntent.client_secret,
        setup_intent_id: setupIntent.id,
      });
    }

    if (action === "confirm") {
      const setupIntentId = body.setup_intent_id;
      if (!setupIntentId) {
        return NextResponse.json({ error: "setup_intent_id required" }, { status: 400 });
      }

      const saved = await savePaymentMethod(
        getSupabaseAdmin(),
        result.member.club_id,
        result.member.id,
        setupIntentId,
        body.set_default !== false
      );

      return NextResponse.json({ payment_method: saved }, { status: 201 });
    }

    return NextResponse.json({ error: "Invalid action. Use 'setup' or 'confirm'." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("POST /api/billing/payment-methods error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/billing/payment-methods?id=<payment_method_id>
 * Remove a payment method.
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getMemberWithTier(supabase, user.id);
    if (!result) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const url = new URL(request.url);
    const pmId = url.searchParams.get("id");
    if (!pmId) {
      return NextResponse.json({ error: "id parameter required" }, { status: 400 });
    }

    await removePaymentMethod(getSupabaseAdmin(), result.member.id, pmId);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("DELETE /api/billing/payment-methods error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

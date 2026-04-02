import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";

/**
 * GET /api/billing/stripe-status — Check if Stripe is configured.
 * Returns { connected: boolean } so the admin UI can show a banner.
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
    if (!caller || caller.member.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const hasSecretKey = !!process.env.STRIPE_SECRET_KEY;
    const hasPublishableKey = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    return NextResponse.json({
      connected: hasSecretKey && hasPublishableKey,
      details: {
        secretKey: hasSecretKey,
        publishableKey: hasPublishableKey,
      },
    });
  } catch (error) {
    console.error("Stripe status check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

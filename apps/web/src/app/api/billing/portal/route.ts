import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { createClient } from "@supabase/supabase-js";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { createPortalSession } from "@/lib/stripe";

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

    // Get stripe_customer_id
    const { data: memberData } = await supabaseAdmin
      .from("members")
      .select("stripe_customer_id")
      .eq("id", result.member.id)
      .single();

    if (!memberData?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No billing account found. Please set up billing first." },
        { status: 400 }
      );
    }

    const origin =
      request.headers.get("origin") || "http://localhost:3000";

    const session = await createPortalSession({
      customerId: memberData.stripe_customer_id,
      returnUrl: `${origin}/dashboard/billing`,
    });

    return NextResponse.json({ portalUrl: session.url });
  } catch (error) {
    console.error("Billing portal error:", error);
    return NextResponse.json(
      { error: "Failed to open billing portal" },
      { status: 500 }
    );
  }
}

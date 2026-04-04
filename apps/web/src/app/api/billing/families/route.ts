import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { updateFamilyBillingSchema } from "@club/shared";

/**
 * PATCH /api/billing/families — Update family billing consolidation settings
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const caller = await getMemberWithTier(supabase, user.id);
    if (!caller || caller.member.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateFamilyBillingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const updates: Record<string, unknown> = {
      billing_consolidated: parsed.data.billing_consolidated,
    };
    if (parsed.data.billing_email !== undefined) {
      updates.billing_email = parsed.data.billing_email;
    }

    const { error } = await adminClient
      .from("families")
      .update(updates)
      .eq("id", parsed.data.family_id)
      .eq("club_id", caller.member.club_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update family billing error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

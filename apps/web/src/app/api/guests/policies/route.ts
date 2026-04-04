import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { createGuestPolicySchema, createGuestFeeScheduleSchema } from "@club/shared";

/**
 * POST /api/guests/policies — Create a guest policy (admin)
 * POST /api/guests/policies?type=fee — Create a fee schedule (admin)
 * DELETE /api/guests/policies?id=xxx — Deactivate a policy (admin)
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

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const body = await request.json();

    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (type === "fee") {
      const parsed = createGuestFeeScheduleSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, { status: 400 });
      }

      const { data, error } = await adminClient
        .from("guest_fee_schedules")
        .insert({ club_id: caller.member.club_id, ...parsed.data })
        .select("*")
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ fee_schedule: data }, { status: 201 });
    }

    // Default: create guest policy
    const parsed = createGuestPolicySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { data, error } = await adminClient
      .from("guest_policies")
      .insert({ club_id: caller.member.club_id, ...parsed.data })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ policy: data }, { status: 201 });
  } catch (error) {
    console.error("Create guest policy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const caller = await getMemberWithTier(supabase, user.id);
    if (!caller || caller.member.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const type = searchParams.get("type");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const table = type === "fee" ? "guest_fee_schedules" : "guest_policies";
    const { error } = await adminClient
      .from(table)
      .update({ is_active: false })
      .eq("id", id)
      .eq("club_id", caller.member.club_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete guest policy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { createAssessmentSchema } from "@club/shared";

/**
 * POST /api/billing/assessments — Create an assessment
 * PATCH /api/billing/assessments?id=xxx — Update assessment status
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
    const parsed = createAssessmentSchema.safeParse(body);
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

    // Calculate installment amount if applicable
    const installmentAmount = input.allow_installments && input.installment_count > 1
      ? Math.round((input.amount / input.installment_count) * 100) / 100
      : input.amount;

    const { data, error } = await adminClient
      .from("assessments")
      .insert({
        club_id: caller.member.club_id,
        name: input.name,
        description: input.description ?? null,
        type: input.type,
        amount: input.amount,
        target_all_members: input.target_all_members,
        target_tier_ids: input.target_tier_ids ?? null,
        target_member_ids: input.target_member_ids ?? null,
        due_date: input.due_date,
        allow_installments: input.allow_installments,
        installment_count: input.installment_count,
        installment_amount: installmentAmount,
        status: "draft",
        created_by: caller.member.id,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ assessment: data }, { status: 201 });
  } catch (error) {
    console.error("Create assessment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
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
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const body = await request.json();
    const { status } = body;

    if (!["active", "completed", "cancelled"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await adminClient
      .from("assessments")
      .update({ status })
      .eq("id", id)
      .eq("club_id", caller.member.club_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update assessment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

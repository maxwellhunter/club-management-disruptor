import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { createInvoiceSchema } from "@club/shared";

/**
 * POST /api/billing/invoices — Admin creates a manual invoice.
 * Used for initiation fees, guest charges, F&B minimums, etc.
 */
export async function POST(request: Request) {
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

    const body = await request.json();
    const parsed = createInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const input = parsed.data;

    // Verify the target member exists in the same club
    const { data: targetMember } = await supabase
      .from("members")
      .select("id, first_name, last_name")
      .eq("id", input.member_id)
      .eq("club_id", caller.member.club_id)
      .maybeSingle();

    if (!targetMember) {
      return NextResponse.json(
        { error: "Member not found in this club" },
        { status: 404 }
      );
    }

    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: invoice, error: insertError } = await adminClient
      .from("invoices")
      .insert({
        club_id: caller.member.club_id,
        member_id: input.member_id,
        amount: input.amount,
        description: input.description,
        due_date: input.due_date,
        status: "draft",
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("Create invoice error:", insertError);
      return NextResponse.json(
        { error: "Failed to create invoice" },
        { status: 500 }
      );
    }

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error("Create invoice error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

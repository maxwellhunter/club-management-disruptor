import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { z } from "zod";

const recordPaymentSchema = z.object({
  member_id: z.string().uuid("Invalid member ID"),
  amount: z.number().min(0.01, "Amount must be positive"),
  method: z.enum(["card", "ach", "check", "cash", "other"]),
  description: z.string().min(1, "Description is required"),
  invoice_id: z.string().uuid().optional().nullable(),
});

/**
 * POST /api/billing/payments — Admin records a manual payment.
 * For check, cash, ACH payments not processed through Stripe.
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
    const parsed = recordPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const input = parsed.data;

    // Verify member is in the same club
    const { data: targetMember } = await supabase
      .from("members")
      .select("id")
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

    const { data: payment, error: insertError } = await adminClient
      .from("payments")
      .insert({
        club_id: caller.member.club_id,
        member_id: input.member_id,
        invoice_id: input.invoice_id || null,
        amount: input.amount,
        method: input.method,
        description: input.description,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("Record payment error:", insertError);
      return NextResponse.json(
        { error: "Failed to record payment" },
        { status: 500 }
      );
    }

    // If linked to an invoice, mark the invoice as paid
    if (input.invoice_id) {
      await adminClient
        .from("invoices")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
        })
        .eq("id", input.invoice_id)
        .in("status", ["sent", "overdue"]);
    }

    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    console.error("Record payment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

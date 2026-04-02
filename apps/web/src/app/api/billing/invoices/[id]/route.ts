import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { z } from "zod";
import { sendInvoiceEmail } from "@/lib/email";

const updateInvoiceSchema = z.object({
  status: z.enum(["sent", "paid", "void", "cancelled"]),
});

/**
 * PATCH /api/billing/invoices/[id] — Admin updates invoice status.
 * Transitions: draft→sent, sent→paid, sent→void, draft→cancelled, etc.
 * When marking as "paid", also records a manual payment.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    const parsed = updateInvoiceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid status. Must be: sent, paid, void, or cancelled" },
        { status: 400 }
      );
    }

    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get the existing invoice
    const { data: invoice } = await adminClient
      .from("invoices")
      .select("*")
      .eq("id", id)
      .eq("club_id", caller.member.club_id)
      .single();

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      draft: ["sent", "cancelled"],
      sent: ["paid", "void", "overdue"],
      overdue: ["paid", "void"],
      paid: [], // Terminal
      void: [], // Terminal
      cancelled: [], // Terminal
    };

    const allowed = validTransitions[invoice.status] || [];
    if (!allowed.includes(parsed.data.status)) {
      return NextResponse.json(
        {
          error: `Cannot change invoice from '${invoice.status}' to '${parsed.data.status}'`,
        },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {
      status: parsed.data.status,
    };

    if (parsed.data.status === "paid") {
      updateData.paid_at = new Date().toISOString();
    }

    const { data: updated, error: updateError } = await adminClient
      .from("invoices")
      .update(updateData)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      console.error("Update invoice error:", updateError);
      return NextResponse.json(
        { error: "Failed to update invoice" },
        { status: 500 }
      );
    }

    // If marking as paid, also create a payment record
    if (parsed.data.status === "paid") {
      const paymentMethod = body.payment_method || "other";
      const paymentDescription =
        body.payment_description || `Manual payment for: ${invoice.description}`;

      await adminClient.from("payments").insert({
        club_id: caller.member.club_id,
        member_id: invoice.member_id,
        invoice_id: invoice.id,
        amount: invoice.amount,
        method: paymentMethod,
        description: paymentDescription,
      });
    }

    // Send invoice email when status changes to "sent"
    if (parsed.data.status === "sent") {
      const { data: member } = await adminClient
        .from("members")
        .select("email, first_name")
        .eq("id", invoice.member_id)
        .single();

      const { data: club } = await supabase
        .from("clubs")
        .select("name")
        .eq("id", caller.member.club_id)
        .single();

      if (member) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        sendInvoiceEmail({
          to: member.email,
          memberName: member.first_name,
          clubName: club?.name ?? "Your Club",
          invoiceDescription: invoice.description,
          amount: invoice.amount,
          dueDate: invoice.due_date,
          dashboardUrl: baseUrl,
        }).catch((err) => console.error("[email] Invoice send failed:", err));
      }
    }

    return NextResponse.json({ invoice: updated });
  } catch (error) {
    console.error("Update invoice error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

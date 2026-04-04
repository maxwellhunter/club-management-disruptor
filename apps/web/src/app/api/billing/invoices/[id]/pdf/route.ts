import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { generateInvoicePdf } from "@/lib/billing/invoice-pdf";

/**
 * GET /api/billing/invoices/[id]/pdf — Download invoice as PDF.
 * Accessible by admins (any invoice in their club) or members (own invoices only).
 */
export async function GET(
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
    if (!caller) {
      return NextResponse.json({ error: "Member not found" }, { status: 403 });
    }

    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch invoice with member and club data
    const { data: invoice, error: invoiceError } = await adminClient
      .from("invoices")
      .select("*")
      .eq("id", id)
      .eq("club_id", caller.member.club_id)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Members can only download their own invoices
    if (
      caller.member.role !== "admin" &&
      caller.member.role !== "staff" &&
      invoice.member_id !== caller.member.id
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Fetch member details
    const { data: member } = await adminClient
      .from("members")
      .select("first_name, last_name, email, member_number")
      .eq("id", invoice.member_id)
      .single();

    // Fetch club details
    const { data: club } = await adminClient
      .from("clubs")
      .select("name, address, phone, email")
      .eq("id", caller.member.club_id)
      .single();

    const invoiceNumber = `INV-${invoice.id.slice(0, 8).toUpperCase()}`;

    const pdfBuffer = await generateInvoicePdf({
      invoiceId: invoice.id,
      invoiceNumber,
      status: invoice.status,
      description: invoice.description,
      amount: invoice.amount,
      dueDate: invoice.due_date,
      createdAt: invoice.created_at,
      paidAt: invoice.paid_at,

      memberName: member
        ? `${member.first_name} ${member.last_name}`
        : "Unknown Member",
      memberEmail: member?.email ?? "",
      memberNumber: member?.member_number ?? null,

      clubName: club?.name ?? "Club",
      clubAddress: club?.address ?? null,
      clubPhone: club?.phone ?? null,
      clubEmail: club?.email ?? null,
    });

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${invoiceNumber}.pdf"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Invoice PDF generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}

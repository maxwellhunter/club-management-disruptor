import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { generateStatementPdf } from "@/lib/billing/statement-pdf";
import type { StatementLineItem } from "@club/shared";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * GET /api/billing/statements/:memberStatementId/pdf
 * Download a PDF for a specific member statement.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: memberStatementId } = await params;
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getMemberWithTier(supabase, user.id);
    if (!result) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    // Fetch the member statement
    const { data: stmt } = await supabase
      .from("member_statements")
      .select("*")
      .eq("id", memberStatementId)
      .eq("club_id", result.member.club_id)
      .single();

    if (!stmt) {
      return NextResponse.json({ error: "Statement not found" }, { status: 404 });
    }

    // Members can only view their own statement
    if (result.member.role === "member" && stmt.member_id !== result.member.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch member details
    const { data: member } = await supabase
      .from("members")
      .select("first_name, last_name, email, member_number, membership_tiers(name)")
      .eq("id", stmt.member_id)
      .single();

    const tier = (member?.membership_tiers as unknown as { name: string } | null);

    // Fetch club details
    const { data: club } = await supabase
      .from("clubs")
      .select("name, address, phone, email")
      .eq("id", result.member.club_id)
      .single();

    // Build period label
    const [year, month] = stmt.period.split("-").map(Number);
    const periodLabel = new Date(year, month - 1, 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    // Reconstruct line items from the period's data
    const lineItems = await buildLineItems(supabase, stmt.member_id, stmt.period, result.member.club_id);

    const pdf = await generateStatementPdf({
      period: periodLabel,
      memberName: `${member?.first_name ?? ""} ${member?.last_name ?? ""}`.trim(),
      memberEmail: member?.email ?? "",
      memberNumber: member?.member_number ?? null,
      tierName: tier?.name ?? null,
      clubName: club?.name ?? "Club",
      clubAddress: club?.address ?? null,
      clubPhone: club?.phone ?? null,
      clubEmail: club?.email ?? null,
      previousBalance: Number(stmt.previous_balance),
      duesAmount: Number(stmt.dues_amount),
      chargesAmount: Number(stmt.charges_amount),
      assessmentsAmount: Number(stmt.assessments_amount),
      creditsAmount: Number(stmt.credits_amount),
      totalDue: Number(stmt.total_due),
      lineItems,
    });

    // Mark as PDF generated
    await supabase
      .from("member_statements")
      .update({ pdf_generated: true })
      .eq("id", memberStatementId);

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="statement-${stmt.period}-${member?.last_name ?? "member"}.pdf"`,
        "Content-Length": pdf.length.toString(),
      },
    });
  } catch (error) {
    console.error("GET /api/billing/statements/[id]/pdf error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Rebuild line items from raw data for the PDF */
async function buildLineItems(
  supabase: SupabaseClient,
  memberId: string,
  period: string,
  clubId: string
): Promise<StatementLineItem[]> {
  const items: StatementLineItem[] = [];

  const [year, month] = period.split("-").map(Number);
  const start = new Date(year, month - 1, 1).toISOString().split("T")[0];
  const end = new Date(year, month, 0).toISOString().split("T")[0];

  // Previous balance — overdue invoices from before period
  const { data: overdueInvoices } = await supabase
    .from("invoices")
    .select("id, amount, description, created_at")
    .eq("club_id", clubId)
    .eq("member_id", memberId)
    .lt("created_at", `${start}T00:00:00`)
    .in("status", ["sent", "overdue"]);

  for (const inv of overdueInvoices ?? []) {
    items.push({
      category: "previous_balance",
      description: inv.description ?? "Previous balance",
      amount: Number(inv.amount),
      date: inv.created_at,
      invoice_id: inv.id,
    });
  }

  // Current period invoices
  const { data: currentInvoices } = await supabase
    .from("invoices")
    .select("id, amount, description, created_at")
    .eq("club_id", clubId)
    .eq("member_id", memberId)
    .gte("created_at", `${start}T00:00:00`)
    .lte("created_at", `${end}T23:59:59`)
    .in("status", ["sent", "paid", "overdue"]);

  for (const inv of currentInvoices ?? []) {
    const desc = (inv.description ?? "").toLowerCase();
    let category: StatementLineItem["category"] = "charges";
    if (desc.includes("dues")) category = "dues";
    else if (desc.includes("assessment") || desc.includes("installment")) category = "assessment";

    items.push({
      category,
      description: inv.description,
      amount: Number(inv.amount),
      date: inv.created_at,
      invoice_id: inv.id,
    });
  }

  // POS charges
  const { data: charges } = await supabase
    .from("pos_transactions")
    .select("id, total, description, created_at, pos_configs(name)")
    .eq("club_id", clubId)
    .eq("member_id", memberId)
    .eq("billing_period", period)
    .eq("payment_method", "member_charge");

  for (const charge of charges ?? []) {
    const loc = (charge.pos_configs as unknown as { name: string } | null)?.name ?? "POS";
    items.push({
      category: "charges",
      description: `${loc}: ${charge.description ?? "Charge"}`,
      amount: Number(charge.total),
      date: charge.created_at,
    });
  }

  // Credits
  const { data: credits } = await supabase
    .from("billing_credits")
    .select("id, amount, reason, created_at")
    .eq("club_id", clubId)
    .eq("member_id", memberId)
    .gte("created_at", `${start}T00:00:00`)
    .lte("created_at", `${end}T23:59:59`);

  for (const credit of credits ?? []) {
    items.push({
      category: "credit",
      description: credit.reason ?? "Account credit",
      amount: -Number(credit.amount),
      date: credit.created_at,
    });
  }

  // Payments
  const { data: payments } = await supabase
    .from("payments")
    .select("id, amount, description, created_at")
    .eq("club_id", clubId)
    .eq("member_id", memberId)
    .gte("created_at", `${start}T00:00:00`)
    .lte("created_at", `${end}T23:59:59`);

  for (const payment of payments ?? []) {
    items.push({
      category: "payment",
      description: payment.description ?? "Payment received",
      amount: -Number(payment.amount),
      date: payment.created_at,
    });
  }

  // Sort by date
  items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return items;
}

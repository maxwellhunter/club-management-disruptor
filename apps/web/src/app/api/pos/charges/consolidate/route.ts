import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { consolidateChargesSchema } from "@club/shared";

/**
 * POST /api/pos/charges/consolidate — Admin consolidates a member's
 * open charges for a billing period into a single invoice.
 *
 * All uninvoiced member_charge transactions for the member+period
 * are linked to the newly created invoice.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getMemberWithTier(supabase, user.id);
    if (!result) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    if (result.member.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = consolidateChargesSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const clubId = result.member.club_id;
    const { member_id, period } = parsed.data;

    // Verify member belongs to same club
    const { data: targetMember } = await supabase
      .from("members")
      .select("id, first_name, last_name, club_id")
      .eq("id", member_id)
      .eq("club_id", clubId)
      .single();

    if (!targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Fetch all uninvoiced member_charge transactions for this member+period
    const { data: openCharges, error: fetchError } = await supabase
      .from("pos_transactions")
      .select("id, total")
      .eq("club_id", clubId)
      .eq("member_id", member_id)
      .eq("billing_period", period)
      .eq("payment_method", "member_charge")
      .is("invoice_id", null);

    if (fetchError) {
      console.error("Consolidate fetch error:", fetchError);
      return NextResponse.json({ error: "Failed to fetch charges" }, { status: 500 });
    }

    if (!openCharges || openCharges.length === 0) {
      return NextResponse.json({ error: "No open charges to consolidate" }, { status: 400 });
    }

    // Calculate grand total
    const grandTotal = openCharges.reduce((sum, t) => sum + Number(t.total), 0);
    const roundedTotal = Math.round(grandTotal * 100) / 100;
    const txCount = openCharges.length;

    // Build a human-readable period label (e.g. "April 2026")
    const [year, month] = period.split("-");
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ];
    const periodLabel = `${monthNames[parseInt(month, 10) - 1]} ${year}`;

    // Due date: last day of the next month
    const periodDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const nextMonthEnd = new Date(periodDate.getFullYear(), periodDate.getMonth() + 2, 0);
    const dueDate = nextMonthEnd.toISOString().split("T")[0];

    // Create the consolidated invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        club_id: clubId,
        member_id,
        amount: roundedTotal,
        status: "sent",
        description: `Member charges — ${periodLabel} (${txCount} transaction${txCount === 1 ? "" : "s"})`,
        due_date: dueDate,
      })
      .select("id")
      .single();

    if (invoiceError || !invoice) {
      console.error("Consolidate invoice creation error:", invoiceError);
      return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
    }

    // Link all open charges to the new invoice
    const txnIds = openCharges.map((t) => t.id);
    const { error: updateError } = await supabase
      .from("pos_transactions")
      .update({ invoice_id: invoice.id })
      .in("id", txnIds);

    if (updateError) {
      console.error("Consolidate update error:", updateError);
      // Invoice was created but linking failed — return partial success
      return NextResponse.json(
        {
          invoice_id: invoice.id,
          amount: roundedTotal,
          transaction_count: txCount,
          warning: "Invoice created but some transactions may not be linked",
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      {
        invoice_id: invoice.id,
        amount: roundedTotal,
        transaction_count: txCount,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/pos/charges/consolidate error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

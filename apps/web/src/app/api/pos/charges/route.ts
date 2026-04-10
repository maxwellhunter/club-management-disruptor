import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { postMemberChargeSchema } from "@club/shared";

/**
 * POST /api/pos/charges — Staff posts a charge to a member's tab.
 * Creates a pos_transaction with payment_method='member_charge'
 * and billing_period set to the current YYYY-MM.
 * No invoice is created yet — charges accumulate until consolidated.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getMemberWithTier(supabase, user.id);
    if (!result) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    if (result.member.role === "member") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = postMemberChargeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const clubId = result.member.club_id;

    // Verify the member exists and belongs to same club
    const { data: targetMember } = await supabase
      .from("members")
      .select("id, first_name, last_name, club_id")
      .eq("id", parsed.data.member_id)
      .eq("club_id", clubId)
      .single();

    if (!targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Verify POS config exists and is active in same club
    const { data: posConfig } = await supabase
      .from("pos_configs")
      .select("id, name, location, is_active, club_id")
      .eq("id", parsed.data.pos_config_id)
      .eq("club_id", clubId)
      .eq("is_active", true)
      .single();

    if (!posConfig) {
      return NextResponse.json({ error: "POS terminal not found or inactive" }, { status: 404 });
    }

    // Calculate totals
    const items = parsed.data.items.map((item) => ({
      ...item,
      total: item.quantity * item.unit_price,
    }));
    const total = parsed.data.subtotal + parsed.data.tax + parsed.data.tip;

    // Current billing period
    const now = new Date();
    const billingPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Insert the transaction (no invoice — charges accumulate)
    const { data: transaction, error: txnError } = await supabase
      .from("pos_transactions")
      .insert({
        club_id: clubId,
        pos_config_id: posConfig.id,
        member_id: parsed.data.member_id,
        invoice_id: null,
        external_id: null,
        type: "sale",
        status: "completed",
        subtotal: parsed.data.subtotal,
        tax: parsed.data.tax,
        tip: parsed.data.tip,
        total,
        payment_method: "member_charge",
        location: posConfig.location,
        description: parsed.data.description ?? null,
        billing_period: billingPeriod,
        metadata: null,
      })
      .select("id, total, billing_period")
      .single();

    if (txnError || !transaction) {
      console.error("Member charge insert error:", txnError);
      return NextResponse.json({ error: "Failed to record charge" }, { status: 500 });
    }

    // Insert line items
    if (items.length > 0) {
      const { error: itemsError } = await supabase.from("pos_transaction_items").insert(
        items.map((item) => ({
          transaction_id: transaction.id,
          name: item.name,
          sku: item.sku ?? null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
          category: item.category ?? null,
        }))
      );

      if (itemsError) {
        console.error("Member charge items insert error:", itemsError);
        // Transaction was created but items failed — log but don't fail the request
      }
    }

    return NextResponse.json(
      {
        transaction: {
          id: transaction.id,
          total: transaction.total,
          billing_period: transaction.billing_period,
          member_name: `${targetMember.first_name} ${targetMember.last_name}`,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/pos/charges error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * GET /api/pos/charges — Get a member's running tab for a billing period.
 * Query params:
 *   member_id — (optional) admin/staff can view any member's tab
 *   period    — (optional) YYYY-MM, defaults to current month
 * Members can only view their own tab.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getMemberWithTier(supabase, user.id);
    if (!result) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const url = new URL(request.url);
    const requestedMemberId = url.searchParams.get("member_id");

    // Default period to current month
    const now = new Date();
    const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const period = url.searchParams.get("period") ?? defaultPeriod;

    // Determine whose tab to show
    let memberId = result.member.id;

    if (requestedMemberId) {
      if (result.member.role === "member" && requestedMemberId !== result.member.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      memberId = requestedMemberId;
    }

    const clubId = result.member.club_id;

    // Look up the member name
    const { data: targetMember } = await supabase
      .from("members")
      .select("id, first_name, last_name")
      .eq("id", memberId)
      .eq("club_id", clubId)
      .single();

    if (!targetMember) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Query all member_charge transactions for member+period
    const { data: transactions, error: txnError } = await supabase
      .from("pos_transactions")
      .select("id, created_at, location, description, subtotal, tax, tip, total, invoice_id")
      .eq("club_id", clubId)
      .eq("member_id", memberId)
      .eq("billing_period", period)
      .eq("payment_method", "member_charge")
      .order("created_at", { ascending: false });

    if (txnError) {
      console.error("Member charges query error:", txnError);
      return NextResponse.json({ error: "Failed to fetch charges" }, { status: 500 });
    }

    const txns = transactions ?? [];

    // Fetch items for each transaction
    const txnIds = txns.map((t) => t.id);
    let allItems: { id: string; transaction_id: string; name: string; quantity: number; unit_price: number; total: number; category: string | null }[] = [];

    if (txnIds.length > 0) {
      const { data: items } = await supabase
        .from("pos_transaction_items")
        .select("id, transaction_id, name, quantity, unit_price, total, category")
        .in("transaction_id", txnIds);

      allItems = items ?? [];
    }

    // Build the MemberChargeTab response
    const chargeTransactions = txns.map((t) => ({
      id: t.id,
      created_at: t.created_at,
      location: t.location,
      description: t.description,
      subtotal: t.subtotal,
      tax: t.tax,
      tip: t.tip,
      total: t.total,
      items: allItems
        .filter((i) => i.transaction_id === t.id)
        .map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          total: i.total,
          category: i.category,
        })),
    }));

    // Calculate summary
    const subtotalTotal = txns.reduce((sum, t) => sum + Number(t.subtotal), 0);
    const taxTotal = txns.reduce((sum, t) => sum + Number(t.tax), 0);
    const tipTotal = txns.reduce((sum, t) => sum + Number(t.tip), 0);
    const grandTotal = txns.reduce((sum, t) => sum + Number(t.total), 0);

    // Check if any transaction is already invoiced (all should share same invoice_id or null)
    const invoiceId = txns.find((t) => t.invoice_id)?.invoice_id ?? null;

    const tab = {
      member_id: memberId,
      member_name: `${targetMember.first_name} ${targetMember.last_name}`,
      period,
      transactions: chargeTransactions,
      summary: {
        transaction_count: txns.length,
        subtotal_total: subtotalTotal,
        tax_total: taxTotal,
        tip_total: tipTotal,
        grand_total: grandTotal,
        invoice_id: invoiceId,
      },
    };

    return NextResponse.json(tab);
  } catch (error) {
    console.error("GET /api/pos/charges error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

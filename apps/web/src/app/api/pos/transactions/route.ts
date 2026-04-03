import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { createPOSTransactionSchema } from "@club/shared";
import { getPOSProvider } from "@/lib/pos";

/**
 * GET /api/pos/transactions — List POS transactions.
 * Admin/staff see all; members see own.
 * Query params: ?limit=50&offset=0&location=dining&status=completed
 */
export async function GET(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getMemberWithTier(supabase, user.id);
    if (!result) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100);
    const offset = parseInt(url.searchParams.get("offset") ?? "0");
    const location = url.searchParams.get("location");
    const status = url.searchParams.get("status");

    let query = supabase
      .from("pos_transactions")
      .select("*, pos_transaction_items(*)")
      .eq("club_id", result.member.club_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Members can only see their own transactions
    if (result.member.role === "member") {
      query = query.eq("member_id", result.member.id);
    }

    if (location) query = query.eq("location", location);
    if (status) query = query.eq("status", status);

    const { data: transactions, error } = await query;

    if (error) {
      console.error("POS transactions query error:", error);
      return NextResponse.json({ error: "Failed to fetch transactions" }, { status: 500 });
    }

    return NextResponse.json({ transactions: transactions ?? [] });
  } catch (error) {
    console.error("POS transactions GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/pos/transactions — Ring up a POS sale.
 * Admin/staff only.
 * Creates the transaction, processes payment via the provider,
 * and optionally creates an invoice for member charges.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getMemberWithTier(supabase, user.id);
    if (!result || result.member.role === "member") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createPOSTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const clubId = result.member.club_id;

    // Verify POS config exists and is active
    const { data: posConfig } = await supabase
      .from("pos_configs")
      .select("*")
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
    const subtotal = parsed.data.subtotal;
    const tax = parsed.data.tax;
    const tip = parsed.data.tip;
    const total = subtotal + tax + tip;

    // Process payment via provider
    const provider = getPOSProvider(posConfig.provider, posConfig.config as Record<string, unknown>);
    const saleResult = await provider.createSale({
      amount: Math.round(total * 100), // convert to cents
      description: parsed.data.description ?? `POS Sale — ${posConfig.name}`,
      memberId: parsed.data.member_id ?? null,
      items: items.map((i) => ({
        name: i.name,
        sku: i.sku ?? null,
        quantity: i.quantity,
        unitPrice: Math.round(i.unit_price * 100),
        category: i.category ?? null,
      })),
      paymentMethod: parsed.data.payment_method ?? undefined,
      location: parsed.data.location,
      metadata: parsed.data.metadata ?? undefined,
    });

    if (!saleResult.success) {
      return NextResponse.json(
        { error: `Payment failed: ${saleResult.error}` },
        { status: 402 }
      );
    }

    // If member_charge, create an invoice on the member's account
    let invoiceId: string | null = null;
    if (parsed.data.payment_method === "member_charge" && parsed.data.member_id) {
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const { data: invoice } = await supabase
        .from("invoices")
        .insert({
          club_id: clubId,
          member_id: parsed.data.member_id,
          amount: total,
          status: "sent",
          description: parsed.data.description ?? `POS charge — ${posConfig.name}`,
          due_date: dueDate.toISOString().split("T")[0],
        })
        .select("id")
        .single();

      invoiceId = invoice?.id ?? null;
    }

    // Create the transaction record
    const { data: transaction, error: txnError } = await supabase
      .from("pos_transactions")
      .insert({
        club_id: clubId,
        pos_config_id: posConfig.id,
        member_id: parsed.data.member_id ?? null,
        invoice_id: invoiceId,
        external_id: saleResult.externalId ?? null,
        type: parsed.data.type,
        status: "completed",
        subtotal,
        tax,
        tip,
        total,
        payment_method: parsed.data.payment_method ?? null,
        location: parsed.data.location,
        description: parsed.data.description ?? null,
        metadata: parsed.data.metadata ?? null,
      })
      .select()
      .single();

    if (txnError || !transaction) {
      console.error("POS transaction insert error:", txnError);
      return NextResponse.json({ error: "Failed to record transaction" }, { status: 500 });
    }

    // Insert line items
    if (items.length > 0) {
      await supabase.from("pos_transaction_items").insert(
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
    }

    return NextResponse.json({ transaction, invoiceId }, { status: 201 });
  } catch (error) {
    console.error("POS transactions POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

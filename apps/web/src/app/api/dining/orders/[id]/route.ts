import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { updateDiningOrderStatusSchema } from "@club/shared";

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

    const result = await getMemberWithTier(supabase, user.id);
    if (!result) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    const { data: order } = await supabase
      .from("dining_orders")
      .select(
        "*, facilities(name), members(first_name, last_name), dining_order_items(*)"
      )
      .eq("id", id)
      .eq("club_id", result.member.club_id)
      .single();

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    const fac = order.facilities as unknown as { name: string } | null;
    const mem = order.members as unknown as {
      first_name: string;
      last_name: string;
    } | null;

    return NextResponse.json({
      order: {
        id: order.id,
        club_id: order.club_id,
        member_id: order.member_id,
        facility_id: order.facility_id,
        booking_id: order.booking_id,
        invoice_id: order.invoice_id,
        status: order.status,
        table_number: order.table_number,
        subtotal: order.subtotal,
        tax: order.tax,
        total: order.total,
        notes: order.notes,
        created_at: order.created_at,
        updated_at: order.updated_at,
        items: order.dining_order_items ?? [],
        facility_name: fac?.name ?? "",
        member_first_name: mem?.first_name ?? "",
        member_last_name: mem?.last_name ?? "",
      },
    });
  } catch (error) {
    console.error("Dining order detail error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Admin: update order status
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

    const result = await getMemberWithTier(supabase, user.id);
    if (!result) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    if (result.member.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateDiningOrderStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Get existing order
    const { data: order } = await supabaseAdmin
      .from("dining_orders")
      .select("id, invoice_id, status")
      .eq("id", id)
      .eq("club_id", result.member.club_id)
      .single();

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // Build update payload
    const updatePayload: Record<string, unknown> = { status: parsed.data.status };
    if (parsed.data.estimated_prep_minutes !== undefined) {
      updatePayload.estimated_prep_minutes = parsed.data.estimated_prep_minutes;
    }

    // Update status (+ optional prep time)
    const { data: updated, error } = await supabaseAdmin
      .from("dining_orders")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to update order" },
        { status: 500 }
      );
    }

    // If cancelled, void the invoice
    if (parsed.data.status === "cancelled" && order.invoice_id) {
      await supabaseAdmin
        .from("invoices")
        .update({ status: "void" })
        .eq("id", order.invoice_id);
    }

    return NextResponse.json({ order: updated });
  } catch (error) {
    console.error("Dining order update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

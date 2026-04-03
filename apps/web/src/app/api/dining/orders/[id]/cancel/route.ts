import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getMemberWithTier } from "@/lib/golf-eligibility";

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

    // Get order — verify ownership
    const { data: order } = await supabase
      .from("dining_orders")
      .select("id, member_id, status, invoice_id")
      .eq("id", id)
      .eq("club_id", result.member.club_id)
      .single();

    if (!order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    // Only allow cancel of own orders (unless admin)
    if (
      order.member_id !== result.member.id &&
      result.member.role !== "admin"
    ) {
      return NextResponse.json(
        { error: "Cannot cancel another member's order" },
        { status: 403 }
      );
    }

    // Only cancel pending orders
    if (order.status !== "pending") {
      return NextResponse.json(
        { error: "Only pending orders can be cancelled" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Cancel the order
    const { data: updated, error } = await supabaseAdmin
      .from("dining_orders")
      .update({ status: "cancelled" })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to cancel order" },
        { status: 500 }
      );
    }

    // Void the linked invoice
    if (order.invoice_id) {
      await supabaseAdmin
        .from("invoices")
        .update({ status: "void" })
        .eq("id", order.invoice_id);
    }

    return NextResponse.json({ order: updated });
  } catch (error) {
    console.error("Dining order cancel error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

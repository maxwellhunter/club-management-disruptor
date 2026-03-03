import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";

export async function GET(request: Request) {
  try {
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

    const { data: orders } = await supabase
      .from("dining_orders")
      .select(
        "*, facilities(name), dining_order_items(*)"
      )
      .eq("club_id", result.member.club_id)
      .eq("member_id", result.member.id)
      .not("status", "in", '("delivered","cancelled")')
      .order("created_at", { ascending: false });

    const formatted = (orders ?? []).map((o) => {
      const fac = o.facilities as unknown as { name: string } | null;
      return {
        id: o.id,
        club_id: o.club_id,
        member_id: o.member_id,
        facility_id: o.facility_id,
        booking_id: o.booking_id,
        invoice_id: o.invoice_id,
        status: o.status,
        table_number: o.table_number,
        subtotal: o.subtotal,
        tax: o.tax,
        total: o.total,
        notes: o.notes,
        created_at: o.created_at,
        updated_at: o.updated_at,
        items: o.dining_order_items ?? [],
        facility_name: fac?.name ?? "",
        member_first_name: result.member.first_name,
        member_last_name: result.member.last_name,
      };
    });

    return NextResponse.json({ orders: formatted });
  } catch (error) {
    console.error("My dining orders error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

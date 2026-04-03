import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { createDiningOrderSchema } from "@club/shared";

const TAX_RATE = 0.08;

export async function POST(request: Request) {
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

    const body = await request.json();
    const parsed = createDiningOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { facility_id, booking_id, table_number, notes, items } =
      parsed.data;

    // Verify facility belongs to user's club
    const { data: facility } = await supabase
      .from("facilities")
      .select("id, name, type")
      .eq("id", facility_id)
      .eq("club_id", result.member.club_id)
      .single();

    if (!facility) {
      return NextResponse.json(
        { error: "Facility not found" },
        { status: 404 }
      );
    }

    // Look up menu items to get current prices
    const menuItemIds = items.map((i) => i.menu_item_id);
    const { data: menuItems } = await supabase
      .from("menu_items")
      .select("id, name, price, is_available")
      .in("id", menuItemIds)
      .eq("club_id", result.member.club_id);

    if (!menuItems || menuItems.length !== menuItemIds.length) {
      return NextResponse.json(
        { error: "One or more menu items not found" },
        { status: 400 }
      );
    }

    // Check availability
    const unavailable = menuItems.filter((mi) => !mi.is_available);
    if (unavailable.length > 0) {
      return NextResponse.json(
        {
          error: `Items unavailable: ${unavailable.map((i) => i.name).join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Build order items with price snapshots
    const menuItemMap = new Map(menuItems.map((mi) => [mi.id, mi]));
    const orderItems = items.map((item) => {
      const mi = menuItemMap.get(item.menu_item_id)!;
      return {
        menu_item_id: item.menu_item_id,
        name: mi.name,
        price: mi.price,
        quantity: item.quantity,
        special_instructions: item.special_instructions ?? null,
      };
    });

    // Calculate totals
    const subtotal = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const tax = Math.round(subtotal * TAX_RATE * 100) / 100;
    const total = Math.round((subtotal + tax) * 100) / 100;

    // Use service role client for creating invoice (RLS only allows admin inserts)
    const supabaseAdmin = getSupabaseAdmin();

    // Create the dining order
    const { data: order, error: orderError } = await supabaseAdmin
      .from("dining_orders")
      .insert({
        club_id: result.member.club_id,
        member_id: result.member.id,
        facility_id,
        booking_id: booking_id ?? null,
        status: "pending",
        table_number: table_number ?? null,
        subtotal,
        tax,
        total,
        notes: notes ?? null,
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error("Order insert error:", orderError);
      return NextResponse.json(
        { error: "Failed to create order" },
        { status: 500 }
      );
    }

    // Insert order items
    const { error: itemsError } = await supabaseAdmin
      .from("dining_order_items")
      .insert(orderItems.map((item) => ({ ...item, order_id: order.id })));

    if (itemsError) {
      console.error("Order items insert error:", itemsError);
      return NextResponse.json(
        { error: "Failed to create order items" },
        { status: 500 }
      );
    }

    // Create invoice charged to member account
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("invoices")
      .insert({
        club_id: result.member.club_id,
        member_id: result.member.id,
        amount: total,
        status: "sent",
        description: `Dining - ${facility.name} (Order #${order.id.slice(0, 8)})`,
        due_date: dueDate.toISOString().split("T")[0],
      })
      .select()
      .single();

    if (invoiceError) {
      console.error("Invoice create error:", invoiceError);
      // Order still created, just no invoice linked
    }

    // Link invoice to order
    if (invoice) {
      await supabaseAdmin
        .from("dining_orders")
        .update({ invoice_id: invoice.id })
        .eq("id", order.id);
    }

    // Fetch full order with items for response
    const { data: fullOrder } = await supabaseAdmin
      .from("dining_orders")
      .select("*")
      .eq("id", order.id)
      .single();

    const { data: fullItems } = await supabaseAdmin
      .from("dining_order_items")
      .select("*")
      .eq("order_id", order.id);

    return NextResponse.json(
      {
        order: {
          ...fullOrder,
          items: fullItems ?? [],
          facility_name: facility.name,
          member_first_name: result.member.first_name,
          member_last_name: result.member.last_name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Dining order API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

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

    // Admins see all club orders, members see own
    let query = supabase
      .from("dining_orders")
      .select(
        "*, facilities(name), members(first_name, last_name), dining_order_items(*)"
      )
      .eq("club_id", result.member.club_id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (result.member.role !== "admin") {
      query = query.eq("member_id", result.member.id);
    }

    const { data: orders } = await query;

    const formatted = (orders ?? []).map((o) => {
      const fac = o.facilities as unknown as { name: string } | null;
      const mem = o.members as unknown as {
        first_name: string;
        last_name: string;
      } | null;
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
        member_first_name: mem?.first_name ?? "",
        member_last_name: mem?.last_name ?? "",
      };
    });

    return NextResponse.json({ orders: formatted });
  } catch (error) {
    console.error("Dining orders list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

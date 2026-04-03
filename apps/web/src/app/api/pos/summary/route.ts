import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";

/**
 * GET /api/pos/summary — POS sales summary/dashboard data.
 * Admin/staff only.
 * Query params: ?date=2026-04-03 (defaults to today)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getMemberWithTier(supabase, user.id);
    if (!result || result.member.role === "member") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const clubId = result.member.club_id;
    const url = new URL(request.url);
    const date = url.searchParams.get("date") ?? new Date().toISOString().split("T")[0];
    const dayStart = `${date}T00:00:00`;
    const dayEnd = `${date}T23:59:59`;

    // Today's completed transactions
    const { data: transactions } = await supabase
      .from("pos_transactions")
      .select("*, pos_transaction_items(*)")
      .eq("club_id", clubId)
      .eq("status", "completed")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .order("created_at", { ascending: false });

    const txns = transactions ?? [];

    // Totals
    const totalSales = txns.reduce((s, t) => s + (t.total ?? 0), 0);
    const tipTotal = txns.reduce((s, t) => s + (t.tip ?? 0), 0);
    const transactionCount = txns.length;
    const averageTicket = transactionCount > 0 ? totalSales / transactionCount : 0;

    // Sales by location
    const locationMap: Record<string, { total: number; count: number }> = {};
    for (const t of txns) {
      const loc = t.location ?? "other";
      if (!locationMap[loc]) locationMap[loc] = { total: 0, count: 0 };
      locationMap[loc].total += t.total ?? 0;
      locationMap[loc].count += 1;
    }
    const salesByLocation = Object.entries(locationMap).map(([location, data]) => ({
      location,
      ...data,
    }));

    // Sales by hour
    const hourMap: Record<number, { total: number; count: number }> = {};
    for (const t of txns) {
      const hour = new Date(t.created_at).getHours();
      if (!hourMap[hour]) hourMap[hour] = { total: 0, count: 0 };
      hourMap[hour].total += t.total ?? 0;
      hourMap[hour].count += 1;
    }
    const salesByHour = Object.entries(hourMap)
      .map(([hour, data]) => ({ hour: parseInt(hour), ...data }))
      .sort((a, b) => a.hour - b.hour);

    // Top items (aggregate across all transactions)
    const itemMap: Record<string, { quantity: number; revenue: number }> = {};
    for (const t of txns) {
      const items = (t.pos_transaction_items ?? []) as {
        name: string;
        quantity: number;
        total: number;
      }[];
      for (const item of items) {
        if (!itemMap[item.name]) itemMap[item.name] = { quantity: 0, revenue: 0 };
        itemMap[item.name].quantity += item.quantity;
        itemMap[item.name].revenue += item.total;
      }
    }
    const topItems = Object.entries(itemMap)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Recent transactions (last 20)
    const recentTransactions = txns.slice(0, 20).map((t) => ({
      id: t.id,
      total: t.total,
      tip: t.tip,
      location: t.location,
      payment_method: t.payment_method,
      description: t.description,
      member_id: t.member_id,
      item_count: ((t.pos_transaction_items ?? []) as unknown[]).length,
      created_at: t.created_at,
    }));

    // Month-to-date totals
    const monthStart = `${date.substring(0, 7)}-01T00:00:00`;
    const { data: mtdTxns } = await supabase
      .from("pos_transactions")
      .select("total")
      .eq("club_id", clubId)
      .eq("status", "completed")
      .gte("created_at", monthStart)
      .lte("created_at", dayEnd);

    const mtdSales = (mtdTxns ?? []).reduce((s, t) => s + (t.total ?? 0), 0);
    const mtdCount = (mtdTxns ?? []).length;

    return NextResponse.json({
      date,
      totalSales,
      transactionCount,
      averageTicket: Math.round(averageTicket * 100) / 100,
      tipTotal,
      salesByLocation,
      salesByHour,
      topItems,
      recentTransactions,
      mtd: { sales: mtdSales, count: mtdCount },
    });
  } catch (error) {
    console.error("POS summary error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

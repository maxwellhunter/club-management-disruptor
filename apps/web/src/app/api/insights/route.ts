import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import Anthropic from "@anthropic-ai/sdk";

/**
 * GET /api/insights — Gather club data for AI analysis
 * POST /api/insights — Generate AI insights from club data
 */
export async function GET(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const caller = await getMemberWithTier(supabase, user.id);
    if (!caller || caller.member.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const clubId = caller.member.club_id;
    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

    // Gather comprehensive club data
    const [
      membersRes, bookingsRes, lastMonthBookingsRes, eventsRes,
      invoicesRes, paymentsRes, posRes, guestVisitsRes
    ] = await Promise.all([
      adminClient.from("members").select("id, status, role, membership_tier_id, join_date").eq("club_id", clubId),
      adminClient.from("bookings").select("id, facility_id, status, date, party_size").eq("club_id", clubId).gte("date", monthStart),
      adminClient.from("bookings").select("id, facility_id, status").eq("club_id", clubId).gte("date", lastMonthStart).lte("date", lastMonthEnd),
      adminClient.from("events").select("id, title, status, start_date, capacity").eq("club_id", clubId).gte("start_date", monthStart),
      adminClient.from("invoices").select("id, amount, status, due_date").eq("club_id", clubId),
      adminClient.from("payments").select("id, amount, method, created_at").eq("club_id", clubId).gte("created_at", monthStart),
      adminClient.from("pos_transactions").select("id, total, location, status, created_at").eq("club_id", clubId).gte("created_at", monthStart),
      adminClient.from("guest_visits").select("id, guest_fee, status, visit_date").eq("club_id", clubId).gte("visit_date", monthStart),
    ]);

    const members = membersRes.data ?? [];
    const bookings = bookingsRes.data ?? [];
    const lastMonthBookings = lastMonthBookingsRes.data ?? [];
    const events = eventsRes.data ?? [];
    const invoices = invoicesRes.data ?? [];
    const payments = paymentsRes.data ?? [];
    const posTxns = posRes.data ?? [];
    const guestVisits = guestVisitsRes.data ?? [];

    // Compute metrics
    const activeMembers = members.filter((m) => m.status === "active").length;
    const newMembersThisMonth = members.filter((m) => m.join_date >= monthStart).length;
    const totalRevenueMTD = payments.reduce((sum, p) => sum + Number(p.amount), 0) + posTxns.filter((t) => t.status === "completed").reduce((sum, t) => sum + Number(t.total), 0);
    const outstandingInvoices = invoices.filter((i) => ["sent", "overdue"].includes(i.status));
    const outstandingAmount = outstandingInvoices.reduce((sum, i) => sum + Number(i.amount), 0);
    const overdueCount = invoices.filter((i) => i.status === "overdue").length;
    const bookingsThisMonth = bookings.length;
    const bookingsLastMonth = lastMonthBookings.length;
    const cancelledBookings = bookings.filter((b) => b.status === "cancelled").length;
    const noShows = bookings.filter((b) => b.status === "no_show").length;
    const guestVisitCount = guestVisits.length;
    const guestFeeRevenue = guestVisits.reduce((sum, v) => sum + Number(v.guest_fee ?? 0), 0);

    const clubData = {
      active_members: activeMembers,
      new_members_this_month: newMembersThisMonth,
      total_members: members.length,
      revenue_mtd: totalRevenueMTD,
      outstanding_amount: outstandingAmount,
      overdue_invoices: overdueCount,
      bookings_this_month: bookingsThisMonth,
      bookings_last_month: bookingsLastMonth,
      booking_change_pct: bookingsLastMonth > 0 ? Math.round(((bookingsThisMonth - bookingsLastMonth) / bookingsLastMonth) * 100) : 0,
      cancelled_bookings: cancelledBookings,
      no_shows: noShows,
      events_this_month: events.length,
      pos_transactions_mtd: posTxns.length,
      pos_revenue_mtd: posTxns.filter((t) => t.status === "completed").reduce((sum, t) => sum + Number(t.total), 0),
      guest_visits_this_month: guestVisitCount,
      guest_fee_revenue: guestFeeRevenue,
    };

    return NextResponse.json({ club_data: clubData });
  } catch (error) {
    console.error("Insights GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const caller = await getMemberWithTier(supabase, user.id);
    if (!caller || caller.member.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI insights require ANTHROPIC_API_KEY to be configured" },
        { status: 503 }
      );
    }

    const body = await request.json();
    const { club_data, focus } = body;

    if (!club_data) {
      return NextResponse.json({ error: "club_data required" }, { status: 400 });
    }

    const anthropic = new Anthropic({ apiKey });

    const systemPrompt = `You are an expert country club business analyst AI. You analyze club operational data and provide actionable insights. Your responses should be specific, data-driven, and focused on actionable recommendations that a club manager can implement immediately.

Format your response as JSON with this structure:
{
  "summary": "One-sentence overall assessment",
  "kpi_health": [
    {"metric": "name", "status": "good|warning|critical", "value": "formatted value", "insight": "brief explanation"}
  ],
  "insights": [
    {"title": "insight title", "category": "revenue|membership|operations|engagement", "priority": "high|medium|low", "description": "detailed explanation with specific numbers", "action": "specific recommended action"}
  ],
  "risks": [
    {"title": "risk title", "severity": "high|medium|low", "description": "explanation"}
  ],
  "opportunities": [
    {"title": "opportunity title", "potential_impact": "brief description of impact", "description": "explanation"}
  ]
}`;

    const userPrompt = `Analyze this country club's current data and provide insights${focus ? ` with a focus on ${focus}` : ""}:

${JSON.stringify(club_data, null, 2)}

Provide 3-5 key insights, 1-3 risks, and 1-3 opportunities. Be specific with numbers and percentages.`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    // Extract text content
    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }

    // Parse JSON from response (handle potential markdown code blocks)
    let insightsJson;
    try {
      const jsonStr = textContent.text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      insightsJson = JSON.parse(jsonStr);
    } catch {
      // If parsing fails, return raw text
      insightsJson = { summary: textContent.text, kpi_health: [], insights: [], risks: [], opportunities: [] };
    }

    return NextResponse.json({ insights: insightsJson });
  } catch (error) {
    console.error("AI Insights error:", error);
    return NextResponse.json({ error: "Failed to generate insights" }, { status: 500 });
  }
}

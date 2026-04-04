import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { sendToClub, sendToMember } from "@/lib/notifications/push-sender";

/**
 * GET /api/notifications — Notification log + stats
 * POST /api/notifications — Send a push notification (admin)
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

    const [logRes, statsRes, templatesRes, tokenCountRes] = await Promise.all([
      adminClient
        .from("notification_log")
        .select("*")
        .eq("club_id", clubId)
        .order("created_at", { ascending: false })
        .limit(50),
      adminClient
        .from("notification_log")
        .select("status", { count: "exact" })
        .eq("club_id", clubId)
        .gte("created_at", `${monthStart}T00:00:00`),
      adminClient
        .from("notification_templates")
        .select("*")
        .eq("club_id", clubId)
        .eq("is_active", true),
      adminClient
        .from("members")
        .select("id", { count: "exact", head: true })
        .eq("club_id", clubId)
        .eq("status", "active")
        .not("push_token", "is", null),
    ]);

    // Count by status this month
    const sentCount = (statsRes.data ?? []).filter((r) => r.status === "sent").length;
    const failedCount = (statsRes.data ?? []).filter((r) => r.status === "failed").length;
    const skippedCount = (statsRes.data ?? []).filter((r) => r.status === "skipped").length;

    return NextResponse.json({
      log: logRes.data ?? [],
      templates: templatesRes.data ?? [],
      stats: {
        sent_this_month: sentCount,
        failed_this_month: failedCount,
        skipped_this_month: skippedCount,
        members_with_tokens: tokenCountRes.count ?? 0,
      },
    });
  } catch (error) {
    console.error("Notifications GET error:", error);
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

    const body = await request.json();
    const { title, message, category, target, tier_ids, member_id } = body;

    if (!title || !message || !category) {
      return NextResponse.json({ error: "title, message, and category are required" }, { status: 400 });
    }

    const clubId = caller.member.club_id;
    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (target === "member" && member_id) {
      const result = await sendToMember(adminClient, clubId, member_id, category, title, message);
      return NextResponse.json({ result }, { status: 201 });
    }

    // Broadcast to club (optionally filtered by tiers)
    const result = await sendToClub(
      adminClient,
      clubId,
      category,
      title,
      message,
      { type: "admin_broadcast" },
      { tierIds: tier_ids }
    );

    return NextResponse.json({ result }, { status: 201 });
  } catch (error) {
    console.error("Send notification error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

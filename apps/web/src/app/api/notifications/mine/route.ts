import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";

/**
 * GET /api/notifications/mine — Return the current member's recent
 * notifications (last 50) + unread count. Backs the Home bell + inbox.
 *
 * POST /api/notifications/mine — Mark notifications as read. Body:
 *   { id?: string } → mark a specific notification read
 *   {}              → mark ALL unread for this member read
 */
export async function GET(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const caller = await getMemberWithTier(supabase, user.id);
    if (!caller) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const [notificationsRes, unreadRes] = await Promise.all([
      adminClient
        .from("notification_log")
        .select("id, category, title, body, data, read_at, sent_at, created_at")
        .eq("club_id", caller.member.club_id)
        .eq("member_id", caller.member.id)
        .order("created_at", { ascending: false })
        .limit(50),
      adminClient
        .from("notification_log")
        .select("id", { count: "exact", head: true })
        .eq("club_id", caller.member.club_id)
        .eq("member_id", caller.member.id)
        .is("read_at", null),
    ]);

    return NextResponse.json({
      notifications: notificationsRes.data ?? [],
      unread_count: unreadRes.count ?? 0,
    });
  } catch (error) {
    console.error("Notifications/mine GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const caller = await getMemberWithTier(supabase, user.id);
    if (!caller) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const id = typeof body?.id === "string" ? body.id : null;

    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const nowISO = new Date().toISOString();

    let query = adminClient
      .from("notification_log")
      .update({ read_at: nowISO })
      .eq("club_id", caller.member.club_id)
      .eq("member_id", caller.member.id)
      .is("read_at", null);

    if (id) query = query.eq("id", id);

    const { error } = await query;
    if (error) {
      console.error("Mark read error:", error);
      return NextResponse.json(
        { error: "Failed to mark as read" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notifications/mine POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

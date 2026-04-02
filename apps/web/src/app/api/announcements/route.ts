import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { createAnnouncementSchema } from "@club/shared";
import { sendAnnouncementEmail } from "@/lib/email";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/announcements — List announcements.
 * Members: only published announcements (optionally filtered by tier).
 * Admins: all announcements for their club.
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

    const result = await getMemberWithTier(supabase, user.id);
    if (!result) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    const isAdmin = result.member.role === "admin";
    const clubId = result.member.club_id;

    let query = supabase
      .from("announcements")
      .select("*")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false });

    if (!isAdmin) {
      // Members only see published announcements
      query = query.not("published_at", "is", null);
    }

    const { data: announcements, error } = await query;

    if (error) {
      console.error("Announcements query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch announcements" },
        { status: 500 }
      );
    }

    // For members, filter by tier targeting
    let filtered = announcements ?? [];
    if (!isAdmin && result.member.membership_tier_id) {
      filtered = filtered.filter((a) => {
        // null target_tier_ids means all members
        if (!a.target_tier_ids || a.target_tier_ids.length === 0) return true;
        return a.target_tier_ids.includes(result.member.membership_tier_id!);
      });
    }

    // Fetch tiers for admin UI (tier targeting dropdown)
    let tiers: { id: string; name: string; level: string }[] = [];
    if (isAdmin) {
      const { data: tierData } = await supabase
        .from("membership_tiers")
        .select("id, name, level")
        .eq("club_id", clubId)
        .eq("is_active", true)
        .order("monthly_dues", { ascending: true });
      tiers = tierData ?? [];
    }

    return NextResponse.json({
      announcements: filtered,
      role: result.member.role,
      tiers,
    });
  } catch (error) {
    console.error("Announcements error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/announcements — Create a new announcement (admin only).
 */
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
    if (!result || result.member.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createAnnouncementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { title, content, priority, target_tier_ids } = parsed.data;

    const { data: announcement, error } = await getSupabaseAdmin()
      .from("announcements")
      .insert({
        club_id: result.member.club_id,
        title,
        content,
        priority: priority ?? "normal",
        target_tier_ids: target_tier_ids ?? null,
        created_by: result.member.id,
        // If publish_now flag is set, publish immediately
        published_at: body.publish ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (error) {
      console.error("Create announcement error:", error);
      return NextResponse.json(
        { error: "Failed to create announcement" },
        { status: 500 }
      );
    }

    // Send email blast if publishing immediately
    if (body.publish && announcement) {
      (async () => {
        try {
          const { data: club } = await supabase
            .from("clubs")
            .select("name")
            .eq("id", result.member.club_id)
            .single();

          let memberQuery = getSupabaseAdmin()
            .from("members")
            .select("email, first_name")
            .eq("club_id", result.member.club_id)
            .eq("status", "active");

          if (
            announcement.target_tier_ids &&
            announcement.target_tier_ids.length > 0
          ) {
            memberQuery = memberQuery.in(
              "membership_tier_id",
              announcement.target_tier_ids
            );
          }

          const { data: members } = await memberQuery;
          const baseUrl =
            process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

          for (const member of members ?? []) {
            await sendAnnouncementEmail({
              to: member.email,
              memberName: member.first_name,
              clubName: club?.name ?? "Your Club",
              title: announcement.title,
              content: announcement.content,
              priority: announcement.priority,
              dashboardUrl: baseUrl,
            });
          }
        } catch (err) {
          console.error("[email] Announcement email blast failed:", err);
        }
      })();
    }

    return NextResponse.json({ announcement }, { status: 201 });
  } catch (error) {
    console.error("Create announcement error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

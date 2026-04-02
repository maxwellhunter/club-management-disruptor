import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { sendAnnouncementEmail } from "@/lib/email";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/announcements/:id — Get a single announcement.
 */
export async function GET(request: Request, { params }: RouteParams) {
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

    const { data: announcement, error } = await supabase
      .from("announcements")
      .select("*")
      .eq("id", id)
      .eq("club_id", result.member.club_id)
      .single();

    if (error || !announcement) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      );
    }

    // Members can only see published announcements
    if (result.member.role !== "admin" && !announcement.published_at) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ announcement });
  } catch (error) {
    console.error("Get announcement error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/announcements/:id — Update an announcement (admin only).
 * Supports updating title, content, priority, target_tier_ids, and publishing.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
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
    if (!result || result.member.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();

    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) updates.title = body.title;
    if (body.content !== undefined) updates.content = body.content;
    if (body.priority !== undefined) updates.priority = body.priority;
    if (body.target_tier_ids !== undefined)
      updates.target_tier_ids = body.target_tier_ids;

    // Publish action
    if (body.action === "publish") {
      updates.published_at = new Date().toISOString();
    }
    // Unpublish (revert to draft)
    if (body.action === "unpublish") {
      updates.published_at = null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No updates provided" },
        { status: 400 }
      );
    }

    const { data: announcement, error } = await getSupabaseAdmin()
      .from("announcements")
      .update(updates)
      .eq("id", id)
      .eq("club_id", result.member.club_id)
      .select()
      .single();

    if (error) {
      console.error("Update announcement error:", error);
      return NextResponse.json(
        { error: "Failed to update announcement" },
        { status: 500 }
      );
    }

    // Send email to members when publishing
    if (body.action === "publish" && announcement) {
      // Fire-and-forget: send emails in background
      (async () => {
        try {
          const { data: club } = await supabase
            .from("clubs")
            .select("name")
            .eq("id", result.member.club_id)
            .single();

          // Get target members
          let memberQuery = getSupabaseAdmin()
            .from("members")
            .select("email, first_name")
            .eq("club_id", result.member.club_id)
            .eq("status", "active");

          // If targeting specific tiers, filter
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

          // Send in batches to avoid rate limits
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

    return NextResponse.json({ announcement });
  } catch (error) {
    console.error("Update announcement error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/announcements/:id — Delete an announcement (admin only).
 */
export async function DELETE(request: Request, { params }: RouteParams) {
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
    if (!result || result.member.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { error } = await getSupabaseAdmin()
      .from("announcements")
      .delete()
      .eq("id", id)
      .eq("club_id", result.member.club_id);

    if (error) {
      console.error("Delete announcement error:", error);
      return NextResponse.json(
        { error: "Failed to delete announcement" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete announcement error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

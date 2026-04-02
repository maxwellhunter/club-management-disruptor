import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { sendInviteEmail } from "@/lib/email";

/**
 * POST /api/members/[id]/resend-invite — Regenerate invite token and resend (admin only).
 * Resets the expiry to 7 days from now and generates a fresh token.
 */
export async function POST(
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

    const caller = await getMemberWithTier(supabase, user.id);
    if (!caller || caller.member.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check the member exists and is in 'invited' status
    const { data: member } = await adminClient
      .from("members")
      .select("id, email, first_name, last_name, status")
      .eq("id", id)
      .eq("club_id", caller.member.club_id)
      .single();

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    if (member.status !== "invited") {
      return NextResponse.json(
        { error: "Can only resend invites to members with 'invited' status" },
        { status: 400 }
      );
    }

    // Generate a new token and extend expiry
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + 7);

    // Use raw SQL to regenerate UUID since Supabase JS can't call gen_random_uuid()
    const { data: updated, error } = await adminClient.rpc("resend_member_invite" as never, {
      member_id: id,
      new_expires_at: newExpiry.toISOString(),
    });

    // Fallback: if the RPC doesn't exist, use a simple update with a UUID from crypto
    if (error) {
      const newToken = crypto.randomUUID();
      const { error: updateError } = await adminClient
        .from("members")
        .update({
          invite_token: newToken,
          invite_expires_at: newExpiry.toISOString(),
          invite_sent_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("club_id", caller.member.club_id);

      if (updateError) {
        console.error("Resend invite error:", updateError);
        return NextResponse.json(
          { error: "Failed to resend invite" },
          { status: 500 }
        );
      }

      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        request.headers.get("origin") ||
        "http://localhost:3000";
      const inviteUrl = `${baseUrl}/invite/${newToken}`;

      // Send email
      const { data: club } = await supabase
        .from("clubs")
        .select("name")
        .eq("id", caller.member.club_id)
        .single();

      const { data: memberTier } = await adminClient
        .from("members")
        .select("membership_tiers(name)")
        .eq("id", id)
        .single();

      const tierName =
        (memberTier?.membership_tiers as unknown as { name: string } | null)
          ?.name ?? "Member";

      const emailResult = await sendInviteEmail({
        to: member.email,
        memberName: member.first_name,
        clubName: club?.name ?? "Your Club",
        tierName,
        inviteUrl,
      });

      return NextResponse.json({
        invite_url: inviteUrl,
        email_sent: emailResult.success,
        message: emailResult.success
          ? "Invite resent via email."
          : "Invite link regenerated. Email not configured — share the link manually.",
      });
    }

    return NextResponse.json({ message: "Invite resent" });
  } catch (error) {
    console.error("Resend invite error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

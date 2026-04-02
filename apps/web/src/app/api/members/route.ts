import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { inviteMemberSchema } from "@club/shared";
import type { DirectoryMember } from "@club/shared";
import { sendInviteEmail } from "@/lib/email";

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

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");
    const tier = searchParams.get("tier");
    const status = searchParams.get("status");

    let query = supabase
      .from("members")
      .select(
        `id, member_number, first_name, last_name, email, phone, avatar_url,
         role, status, join_date,
         membership_tiers ( name, level )`
      )
      .eq("club_id", result.member.club_id)
      .eq("status", status || "active")
      .order("last_name", { ascending: true });

    if (tier) {
      query = query.eq("membership_tier_id", tier);
    }

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    const { data: members, error } = await query;

    if (error) {
      console.error("Members query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch members" },
        { status: 500 }
      );
    }

    const directoryMembers: DirectoryMember[] = (members ?? []).map((m) => {
      const tierData = m.membership_tiers as unknown as {
        name: string;
        level: string;
      } | null;
      return {
        id: m.id,
        member_number: m.member_number,
        first_name: m.first_name,
        last_name: m.last_name,
        email: m.email,
        phone: m.phone,
        avatar_url: m.avatar_url,
        role: m.role,
        status: m.status,
        join_date: m.join_date,
        tier_name: tierData?.name ?? null,
        tier_level: (tierData?.level as DirectoryMember["tier_level"]) ?? null,
      };
    });

    // Fetch tiers for filter dropdown
    const { data: tiers } = await supabase
      .from("membership_tiers")
      .select("id, name, level")
      .eq("club_id", result.member.club_id)
      .eq("is_active", true)
      .order("name", { ascending: true });

    return NextResponse.json({
      members: directoryMembers,
      tiers: tiers ?? [],
      role: result.member.role,
    });
  } catch (error) {
    console.error("Members API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/members — Admin creates a member and optionally sends an invite email.
 * Creates a members row with status='invited', generates an invite_token,
 * and (when Resend is wired) sends an email with the claim link.
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

    // Verify the caller is an admin
    const result = await getMemberWithTier(supabase, user.id);
    if (!result || result.member.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = inviteMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const input = parsed.data;

    // Check for duplicate email in the same club
    const { data: existing } = await supabase
      .from("members")
      .select("id")
      .eq("club_id", result.member.club_id)
      .eq("email", input.email)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "A member with this email already exists at this club" },
        { status: 409 }
      );
    }

    // Use service role client to bypass RLS for the insert
    // (RLS requires get_member_club_id() which uses the inserting user's club_id,
    //  but we also need to set invite_token which is easier with service role)
    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const inviteExpiresAt = new Date();
    inviteExpiresAt.setDate(inviteExpiresAt.getDate() + 7); // 7-day expiry

    const { data: newMember, error: insertError } = await adminClient
      .from("members")
      .insert({
        club_id: result.member.club_id,
        first_name: input.first_name,
        last_name: input.last_name,
        email: input.email,
        phone: input.phone || null,
        role: input.role,
        membership_tier_id: input.membership_tier_id || null,
        member_number: input.member_number || null,
        notes: input.notes || null,
        status: "invited",
        user_id: null,
        invite_expires_at: inviteExpiresAt.toISOString(),
        invite_sent_at: input.send_invite ? new Date().toISOString() : null,
      })
      .select("id, invite_token, email, first_name, last_name")
      .single();

    if (insertError) {
      console.error("Insert member error:", insertError);
      return NextResponse.json(
        { error: "Failed to create member" },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get("origin") || "http://localhost:3000";
    const inviteUrl = `${baseUrl}/invite/${newMember.invite_token}`;

    // Send invite email if requested
    let emailSent = false;
    if (input.send_invite) {
      // Look up tier name for the email
      let tierName = "Member";
      if (input.membership_tier_id) {
        const { data: tier } = await supabase
          .from("membership_tiers")
          .select("name")
          .eq("id", input.membership_tier_id)
          .single();
        if (tier) tierName = tier.name;
      }

      // Look up club name
      const { data: club } = await supabase
        .from("clubs")
        .select("name")
        .eq("id", result.member.club_id)
        .single();

      const emailResult = await sendInviteEmail({
        to: input.email,
        memberName: input.first_name,
        clubName: club?.name ?? "Your Club",
        tierName,
        inviteUrl,
      });
      emailSent = emailResult.success;
    }

    return NextResponse.json({
      member: newMember,
      invite_url: inviteUrl,
      email_sent: emailSent,
      message: emailSent
        ? "Member created and invite email sent."
        : input.send_invite
          ? "Member created. Email not configured — share the invite link manually."
          : "Member created without sending invite.",
    }, { status: 201 });
  } catch (error) {
    console.error("Create member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

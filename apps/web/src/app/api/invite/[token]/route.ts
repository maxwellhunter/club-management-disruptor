import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { claimInviteSchema } from "@club/shared";
import type { InviteInfo } from "@club/shared";

/**
 * GET /api/invite/[token] — Load invite details for the claim page.
 * No auth required. Returns club name, member name, tier, etc.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const supabase = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Look up the invite
    const { data: member, error } = await supabase
      .from("members")
      .select(
        `id, first_name, last_name, email, status,
         invite_token, invite_expires_at,
         membership_tiers ( name ),
         clubs ( name, logo_url )`
      )
      .eq("invite_token", token)
      .eq("status", "invited")
      .maybeSingle();

    if (error || !member) {
      return NextResponse.json(
        { error: "Invalid or expired invite link" },
        { status: 404 }
      );
    }

    // Check expiry
    if (
      member.invite_expires_at &&
      new Date(member.invite_expires_at) < new Date()
    ) {
      return NextResponse.json(
        { error: "This invite has expired. Please contact your club administrator." },
        { status: 410 }
      );
    }

    const club = member.clubs as unknown as { name: string; logo_url: string | null };
    const tier = member.membership_tiers as unknown as { name: string } | null;

    const info: InviteInfo = {
      member_id: member.id,
      first_name: member.first_name,
      last_name: member.last_name,
      email: member.email,
      tier_name: tier?.name ?? null,
      club_name: club.name,
      club_logo_url: club.logo_url,
      expires_at: member.invite_expires_at,
    };

    return NextResponse.json(info);
  } catch (error) {
    console.error("Invite lookup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/invite/[token] — Claim an invite by setting a password.
 * Creates a Supabase Auth user, links it to the member record, sets status to 'active'.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();

    const parsed = claimInviteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Look up the invite
    const { data: member, error: lookupError } = await supabase
      .from("members")
      .select("id, email, first_name, last_name, club_id, status, invite_expires_at")
      .eq("invite_token", token)
      .eq("status", "invited")
      .maybeSingle();

    if (lookupError || !member) {
      return NextResponse.json(
        { error: "Invalid or expired invite link" },
        { status: 404 }
      );
    }

    // Check expiry
    if (
      member.invite_expires_at &&
      new Date(member.invite_expires_at) < new Date()
    ) {
      return NextResponse.json(
        { error: "This invite has expired. Please contact your club administrator." },
        { status: 410 }
      );
    }

    // Create the Supabase Auth user (using admin API — auto-confirms email)
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email: member.email,
        password: parsed.data.password,
        email_confirm: true,
        user_metadata: {
          full_name: `${member.first_name} ${member.last_name}`,
        },
      });

    if (authError) {
      // If user already exists in auth, try to link them
      if (authError.message?.includes("already been registered")) {
        // Look up existing auth user
        const { data: existingUsers } =
          await supabase.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(
          (u) => u.email === member.email
        );

        if (existingUser) {
          // Link existing auth user to this member
          const { error: updateError } = await supabase
            .from("members")
            .update({
              user_id: existingUser.id,
              status: "active",
              invite_accepted_at: new Date().toISOString(),
              invite_token: null,
            })
            .eq("id", member.id);

          if (updateError) {
            console.error("Update member error:", updateError);
            return NextResponse.json(
              { error: "Failed to activate account" },
              { status: 500 }
            );
          }

          return NextResponse.json({
            message: "Account activated! You already had an account — please log in with your existing password.",
            redirect: "/login",
          });
        }
      }

      console.error("Auth create error:", authError);
      return NextResponse.json(
        { error: "Failed to create account. " + authError.message },
        { status: 500 }
      );
    }

    // Link the new auth user to the member record
    const { error: updateError } = await supabase
      .from("members")
      .update({
        user_id: authData.user.id,
        status: "active",
        invite_accepted_at: new Date().toISOString(),
        invite_token: null, // Clear the token so it can't be reused
      })
      .eq("id", member.id);

    if (updateError) {
      console.error("Update member error:", updateError);
      // Attempt to clean up the auth user we just created
      await supabase.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: "Failed to activate account" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Account created! You can now log in.",
      redirect: "/login",
    });
  } catch (error) {
    console.error("Invite claim error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

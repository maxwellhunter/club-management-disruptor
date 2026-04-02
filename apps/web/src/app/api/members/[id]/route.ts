import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { updateMemberSchema } from "@club/shared";

/**
 * GET /api/members/[id] — Fetch a single member's full profile.
 * All club members can view; admins get extra fields (notes, invite info).
 */
export async function GET(
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
    if (!caller) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Base columns (always available — invite columns may not exist until migration 00008 is applied)
    const baseSelect = `id, club_id, member_number, first_name, last_name, email, phone,
         avatar_url, role, status, join_date, notes, user_id,
         membership_tier_id, family_id, created_at, updated_at,
         membership_tiers ( id, name, level ),
         families!members_family_id_fkey ( id, name )`;

    // Try with invite columns first, fall back without them
    let member: Record<string, unknown> | null = null;
    let hasInviteColumns = true;

    const { data: fullData, error: fullError } = await supabase
      .from("members")
      .select(
        `${baseSelect},
         invite_token, invite_expires_at, invite_sent_at, invite_accepted_at`
      )
      .eq("id", id)
      .eq("club_id", caller.member.club_id)
      .maybeSingle();

    if (fullError && fullError.code === "42703") {
      // invite columns don't exist yet — query without them
      hasInviteColumns = false;
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("members")
        .select(baseSelect)
        .eq("id", id)
        .eq("club_id", caller.member.club_id)
        .maybeSingle();

      if (fallbackError) {
        console.error("Member detail query error:", fallbackError);
        return NextResponse.json(
          { error: "Failed to fetch member" },
          { status: 500 }
        );
      }
      member = fallbackData as Record<string, unknown> | null;
    } else if (fullError) {
      console.error("Member detail query error:", fullError);
      return NextResponse.json(
        { error: "Failed to fetch member" },
        { status: 500 }
      );
    } else {
      member = fullData as Record<string, unknown> | null;
    }

    if (!member) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    // Non-admins shouldn't see notes or invite info
    const isAdmin = caller.member.role === "admin";
    const isSelf = member.id === caller.member.id;

    const response: Record<string, unknown> = {
      ...member,
      tier: member.membership_tiers || null,
      family: member.families || null,
      // Ensure invite fields exist (even if null)
      invite_token: member.invite_token ?? null,
      invite_expires_at: member.invite_expires_at ?? null,
      invite_sent_at: member.invite_sent_at ?? null,
      invite_accepted_at: member.invite_accepted_at ?? null,
    };

    if (!isAdmin && !isSelf) {
      delete response.notes;
      delete response.invite_token;
      delete response.invite_expires_at;
      delete response.invite_sent_at;
      delete response.invite_accepted_at;
    }

    // Strip the raw join fields
    delete response.membership_tiers;
    delete response.families;

    return NextResponse.json({ member: response, role: caller.member.role });
  } catch (error) {
    console.error("Member detail error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/members/[id] — Update a member's profile.
 * Admins can update any member; members can update their own limited fields.
 */
export async function PATCH(
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
    if (!caller) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const isAdmin = caller.member.role === "admin";
    const isSelf = caller.member.id === id;

    if (!isAdmin && !isSelf) {
      return NextResponse.json(
        { error: "You can only edit your own profile" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = updateMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const input = parsed.data;

    // Non-admins can only update phone and notes (self-service fields)
    const allowedSelfFields = ["phone", "notes"];
    const updateData: Record<string, unknown> = {};

    if (isAdmin) {
      // Admin can update everything in the schema
      if (input.first_name !== undefined) updateData.first_name = input.first_name;
      if (input.last_name !== undefined) updateData.last_name = input.last_name;
      if (input.email !== undefined) updateData.email = input.email;
      if (input.phone !== undefined) updateData.phone = input.phone || null;
      if (input.role !== undefined) updateData.role = input.role;
      if (input.membership_tier_id !== undefined)
        updateData.membership_tier_id = input.membership_tier_id || null;
      if (input.member_number !== undefined)
        updateData.member_number = input.member_number || null;
      if (input.notes !== undefined) updateData.notes = input.notes || null;
    } else {
      // Self-service: limited fields
      for (const key of allowedSelfFields) {
        if (key in input) {
          updateData[key] = (input as Record<string, unknown>)[key] || null;
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Use service role for the update to bypass RLS complexities
    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: updated, error: updateError } = await adminClient
      .from("members")
      .update(updateData)
      .eq("id", id)
      .eq("club_id", caller.member.club_id)
      .select(
        `id, member_number, first_name, last_name, email, phone,
         avatar_url, role, status, join_date, notes,
         membership_tier_id, membership_tiers ( id, name, level )`
      )
      .single();

    if (updateError) {
      console.error("Update member error:", updateError);
      if (updateError.code === "23505") {
        return NextResponse.json(
          { error: "A member with this email or member number already exists" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Failed to update member" },
        { status: 500 }
      );
    }

    return NextResponse.json({ member: updated });
  } catch (error) {
    console.error("Update member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/members/[id] — Remove a member (admin only).
 * Soft-deletes by setting status to 'inactive'. Use status endpoint to reverse.
 */
export async function DELETE(
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

    // Prevent admin from deleting themselves
    if (caller.member.id === id) {
      return NextResponse.json(
        { error: "You cannot remove yourself" },
        { status: 400 }
      );
    }

    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await adminClient
      .from("members")
      .update({ status: "inactive" })
      .eq("id", id)
      .eq("club_id", caller.member.club_id);

    if (error) {
      console.error("Delete member error:", error);
      return NextResponse.json(
        { error: "Failed to remove member" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Member deactivated" });
  } catch (error) {
    console.error("Delete member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

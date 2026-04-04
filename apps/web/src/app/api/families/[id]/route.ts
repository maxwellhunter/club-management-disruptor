import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { updateFamilySchema } from "@club/shared";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * PATCH /api/families/[id] — Update a family (admin only).
 * Also handles member assignment: { action: "add_member", member_id } or { action: "remove_member", member_id }
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

    const result = await getMemberWithTier(supabase, user.id);
    if (!result || result.member.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Verify family belongs to this club
    const { data: family } = await supabase
      .from("families")
      .select("id, club_id")
      .eq("id", id)
      .eq("club_id", result.member.club_id)
      .single();

    if (!family) {
      return NextResponse.json(
        { error: "Family not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const admin = getSupabaseAdmin();

    // Handle member assignment actions
    if (body.action === "add_member" && body.member_id) {
      // Verify member is in the same club
      const { data: memberCheck } = await supabase
        .from("members")
        .select("id, club_id")
        .eq("id", body.member_id)
        .eq("club_id", result.member.club_id)
        .single();

      if (!memberCheck) {
        return NextResponse.json(
          { error: "Member not found in this club" },
          { status: 404 }
        );
      }

      const { error } = await admin
        .from("members")
        .update({ family_id: id })
        .eq("id", body.member_id);

      if (error) {
        console.error("Add member to family error:", error);
        return NextResponse.json(
          { error: "Failed to add member to family" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    if (body.action === "remove_member" && body.member_id) {
      const { error } = await admin
        .from("members")
        .update({ family_id: null })
        .eq("id", body.member_id)
        .eq("club_id", result.member.club_id);

      if (error) {
        console.error("Remove member from family error:", error);
        return NextResponse.json(
          { error: "Failed to remove member from family" },
          { status: 500 }
        );
      }

      // If the removed member was the primary, clear it
      await admin
        .from("families")
        .update({ primary_member_id: null })
        .eq("id", id)
        .eq("primary_member_id", body.member_id);

      return NextResponse.json({ success: true });
    }

    if (body.action === "set_primary" && body.member_id) {
      const { error } = await admin
        .from("families")
        .update({ primary_member_id: body.member_id })
        .eq("id", id);

      if (error) {
        return NextResponse.json(
          { error: "Failed to set primary member" },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    // Handle name/primary updates
    const parsed = updateFamilySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.primary_member_id !== undefined)
      updateData.primary_member_id = parsed.data.primary_member_id;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data: updated, error } = await admin
      .from("families")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Update family error:", error);
      return NextResponse.json(
        { error: "Failed to update family" },
        { status: 500 }
      );
    }

    return NextResponse.json({ family: updated });
  } catch (error) {
    console.error("Update family error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/families/[id] — Delete a family (admin only).
 * Unlinks all members from this family first.
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

    const result = await getMemberWithTier(supabase, user.id);
    if (!result || result.member.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const admin = getSupabaseAdmin();

    // Unlink all members from this family
    await admin
      .from("members")
      .update({ family_id: null })
      .eq("family_id", id)
      .eq("club_id", result.member.club_id);

    // Delete the family
    const { error } = await admin
      .from("families")
      .delete()
      .eq("id", id)
      .eq("club_id", result.member.club_id);

    if (error) {
      console.error("Delete family error:", error);
      return NextResponse.json(
        { error: "Failed to delete family" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete family error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

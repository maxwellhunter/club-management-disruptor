import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/tiers/[id] — Get a single tier.
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

    const { data: tier, error } = await supabase
      .from("membership_tiers")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !tier) {
      return NextResponse.json({ error: "Tier not found" }, { status: 404 });
    }

    return NextResponse.json({ tier });
  } catch (error) {
    console.error("Get tier error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tiers/[id] — Update a tier (admin only).
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

    const body = await request.json();

    // Build update object from allowed fields
    const allowedFields = [
      "name",
      "level",
      "description",
      "monthly_dues",
      "annual_dues",
      "benefits",
      "is_active",
    ];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const { data: tier, error } = await getSupabaseAdmin()
      .from("membership_tiers")
      .update(updates)
      .eq("id", id)
      .eq("club_id", result.member.club_id)
      .select()
      .single();

    if (error) {
      console.error("Update tier error:", error);
      return NextResponse.json(
        { error: "Failed to update tier" },
        { status: 500 }
      );
    }

    return NextResponse.json({ tier });
  } catch (error) {
    console.error("Update tier error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tiers/[id] — Delete a tier (admin only).
 * Only allowed if no members are assigned to this tier.
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

    // Check if any members are assigned to this tier
    const { count } = await getSupabaseAdmin()
      .from("members")
      .select("id", { count: "exact", head: true })
      .eq("membership_tier_id", id)
      .eq("club_id", result.member.club_id);

    if (count && count > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete tier — ${count} member${count === 1 ? " is" : "s are"} assigned to it. Reassign them first, or deactivate the tier instead.`,
        },
        { status: 409 }
      );
    }

    const { error } = await getSupabaseAdmin()
      .from("membership_tiers")
      .delete()
      .eq("id", id)
      .eq("club_id", result.member.club_id);

    if (error) {
      console.error("Delete tier error:", error);
      return NextResponse.json(
        { error: "Failed to delete tier" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete tier error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

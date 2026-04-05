import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getMemberWithTier } from "@/lib/golf-eligibility";

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
    if (!result) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    if (result.member.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await request.json();

    // Only allow updating specific fields
    const allowedFields = ["tables", "description", "capacity", "is_active"];
    const updatePayload: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) {
        updatePayload[key] = body[key];
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data: facility, error } = await supabaseAdmin
      .from("facilities")
      .update(updatePayload)
      .eq("id", id)
      .eq("club_id", result.member.club_id)
      .select()
      .single();

    if (error) {
      console.error("Facility update error:", error);
      return NextResponse.json(
        { error: "Failed to update facility" },
        { status: 500 }
      );
    }

    return NextResponse.json({ facility });
  } catch (error) {
    console.error("Facility PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

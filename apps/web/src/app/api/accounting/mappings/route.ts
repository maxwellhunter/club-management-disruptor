import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { createGLMappingSchema } from "@club/shared";

/**
 * POST /api/accounting/mappings — Create a GL mapping.
 * Maps a revenue source category to a GL account.
 * Admin only.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getMemberWithTier(supabase, user.id);
    if (!result || result.member.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createGLMappingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("gl_mappings")
      .insert({ ...parsed.data, club_id: result.member.club_id })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Mapping for this category already exists" }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ mapping: data }, { status: 201 });
  } catch (error) {
    console.error("GL mapping POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/accounting/mappings — Delete a GL mapping by ID.
 * Admin only.
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getMemberWithTier(supabase, user.id);
    if (!result || result.member.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing mapping id" }, { status: 400 });

    const { error } = await supabase
      .from("gl_mappings")
      .delete()
      .eq("id", id)
      .eq("club_id", result.member.club_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("GL mapping DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

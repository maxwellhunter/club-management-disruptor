import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { updatePOSConfigSchema } from "@club/shared";

/**
 * PATCH /api/pos/config/[id] — Update a POS configuration.
 * Admin only.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getMemberWithTier(supabase, user.id);
    if (!result || result.member.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updatePOSConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { data: config, error } = await supabase
      .from("pos_configs")
      .update(parsed.data)
      .eq("id", id)
      .eq("club_id", result.member.club_id)
      .select()
      .single();

    if (error || !config) {
      return NextResponse.json({ error: "Config not found" }, { status: 404 });
    }

    return NextResponse.json({ config });
  } catch (error) {
    console.error("POS config PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE /api/pos/config/[id] — Delete a POS configuration.
 * Admin only. Fails if there are existing transactions.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getMemberWithTier(supabase, user.id);
    if (!result || result.member.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check for existing transactions
    const { count } = await supabase
      .from("pos_transactions")
      .select("id", { count: "exact", head: true })
      .eq("pos_config_id", id);

    if ((count ?? 0) > 0) {
      return NextResponse.json(
        { error: "Cannot delete a POS config with existing transactions. Deactivate it instead." },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from("pos_configs")
      .delete()
      .eq("id", id)
      .eq("club_id", result.member.club_id);

    if (error) {
      console.error("POS config delete error:", error);
      return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POS config DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

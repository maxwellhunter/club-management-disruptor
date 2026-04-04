import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { updateCardTemplateSchema } from "@club/shared";

/**
 * GET /api/wallet/templates — Get active card template
 * POST /api/wallet/templates — Create or update card template (admin)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const caller = await getMemberWithTier(supabase, user.id);
    if (!caller)
      return NextResponse.json({ error: "Not a member" }, { status: 403 });

    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: template } = await adminClient
      .from("card_templates")
      .select("*")
      .eq("club_id", caller.member.club_id)
      .eq("is_active", true)
      .single();

    return NextResponse.json({ template: template || null });
  } catch (error) {
    console.error("Wallet template GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const caller = await getMemberWithTier(supabase, user.id);
    if (!caller || caller.member.role !== "admin")
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );

    const body = await request.json();
    const parsed = updateCardTemplateSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );

    const clubId = caller.member.club_id;
    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if template exists
    const { data: existing } = await adminClient
      .from("card_templates")
      .select("id")
      .eq("club_id", clubId)
      .eq("is_active", true)
      .single();

    if (existing) {
      const { data: updated, error } = await adminClient
        .from("card_templates")
        .update(parsed.data)
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: "Failed to update template" },
          { status: 500 }
        );
      }
      return NextResponse.json({ template: updated });
    } else {
      const { data: created, error } = await adminClient
        .from("card_templates")
        .insert({
          club_id: clubId,
          ...parsed.data,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: "Failed to create template" },
          { status: 500 }
        );
      }
      return NextResponse.json({ template: created });
    }
  } catch (error) {
    console.error("Wallet template POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

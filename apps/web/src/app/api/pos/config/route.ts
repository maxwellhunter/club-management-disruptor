import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { createPOSConfigSchema, updatePOSConfigSchema } from "@club/shared";
import { getPOSProvider } from "@/lib/pos";

/**
 * GET /api/pos/config — List POS configurations for the club.
 * Admin/staff only.
 */
export async function GET(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getMemberWithTier(supabase, user.id);
    if (!result || result.member.role === "member") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: configs } = await supabase
      .from("pos_configs")
      .select("*")
      .eq("club_id", result.member.club_id)
      .order("name");

    return NextResponse.json({ configs: configs ?? [] });
  } catch (error) {
    console.error("POS config GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/pos/config — Create a new POS configuration.
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
    const parsed = createPOSConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Validate provider config if not manual
    if (parsed.data.provider !== "manual") {
      const adapter = getPOSProvider(parsed.data.provider, parsed.data.config);
      const validation = await adapter.validateConfig(parsed.data.config);
      if (!validation.valid) {
        return NextResponse.json(
          { error: `Provider validation failed: ${validation.error}` },
          { status: 400 }
        );
      }
    }

    const { data: config, error } = await supabase
      .from("pos_configs")
      .insert({
        club_id: result.member.club_id,
        ...parsed.data,
      })
      .select()
      .single();

    if (error) {
      console.error("POS config insert error:", error);
      return NextResponse.json({ error: "Failed to create POS config" }, { status: 500 });
    }

    return NextResponse.json({ config }, { status: 201 });
  } catch (error) {
    console.error("POS config POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

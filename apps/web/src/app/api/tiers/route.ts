import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { createTierSchema } from "@club/shared";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/tiers — List membership tiers for the current club.
 * Any authenticated member can view tiers.
 * Admins also receive member counts per tier.
 */
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

    const isAdmin = result.member.role === "admin";
    const clubId = result.member.club_id;

    const { data: tiers, error } = await supabase
      .from("membership_tiers")
      .select("*")
      .eq("club_id", clubId)
      .order("monthly_dues", { ascending: true });

    if (error) {
      console.error("Tiers query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch tiers" },
        { status: 500 }
      );
    }

    // For admins, include member count per tier
    let memberCounts: Record<string, number> = {};
    if (isAdmin) {
      const { data: members } = await getSupabaseAdmin()
        .from("members")
        .select("membership_tier_id")
        .eq("club_id", clubId)
        .in("status", ["active", "invited", "pending"]);

      if (members) {
        for (const m of members) {
          if (m.membership_tier_id) {
            memberCounts[m.membership_tier_id] =
              (memberCounts[m.membership_tier_id] || 0) + 1;
          }
        }
      }
    }

    return NextResponse.json({
      tiers: tiers ?? [],
      memberCounts,
      role: result.member.role,
    });
  } catch (error) {
    console.error("Tiers error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tiers — Create a new membership tier (admin only).
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

    const result = await getMemberWithTier(supabase, user.id);
    if (!result || result.member.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createTierSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, level, description, monthly_dues, annual_dues, benefits } =
      parsed.data;

    const { data: tier, error } = await getSupabaseAdmin()
      .from("membership_tiers")
      .insert({
        club_id: result.member.club_id,
        name,
        level,
        description: description ?? null,
        monthly_dues,
        annual_dues: annual_dues ?? null,
        benefits,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Create tier error:", error);
      return NextResponse.json(
        { error: "Failed to create tier" },
        { status: 500 }
      );
    }

    return NextResponse.json({ tier }, { status: 201 });
  } catch (error) {
    console.error("Create tier error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

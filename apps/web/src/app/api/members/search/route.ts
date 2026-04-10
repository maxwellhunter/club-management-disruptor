import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";

/**
 * GET /api/members/search?q=...&limit=10
 * Lightweight member search for player picker autocomplete.
 * Returns id, name, email, tier. Only active members in the caller's club.
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

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "10"), 20);

    if (q.length < 2) {
      return NextResponse.json({ members: [] });
    }

    const { data: members, error } = await supabase
      .from("members")
      .select(
        `id, first_name, last_name, email, avatar_url,
         membership_tiers (name, level)`
      )
      .eq("club_id", result.member.club_id)
      .eq("status", "active")
      .or(
        `first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`
      )
      .neq("id", result.member.id) // Exclude the booking member (they're added automatically)
      .order("last_name", { ascending: true })
      .limit(limit);

    if (error) {
      console.error("Member search error:", error);
      return NextResponse.json(
        { error: "Search failed" },
        { status: 500 }
      );
    }

    const formatted = (members ?? []).map((m) => {
      const tier = m.membership_tiers as unknown as {
        name: string;
        level: string;
      } | null;
      return {
        id: m.id,
        first_name: m.first_name,
        last_name: m.last_name,
        email: m.email,
        avatar_url: m.avatar_url,
        tier_name: tier?.name ?? null,
        tier_level: tier?.level ?? null,
      };
    });

    return NextResponse.json({ members: formatted });
  } catch (error) {
    console.error("Member search API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

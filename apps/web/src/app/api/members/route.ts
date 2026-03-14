import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import type { DirectoryMember } from "@club/shared";

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
    const search = searchParams.get("search");
    const tier = searchParams.get("tier");
    const status = searchParams.get("status");

    let query = supabase
      .from("members")
      .select(
        `id, member_number, first_name, last_name, email, phone, avatar_url,
         role, status, join_date,
         membership_tiers ( name, level )`
      )
      .eq("club_id", result.member.club_id)
      .eq("status", status || "active")
      .order("last_name", { ascending: true });

    if (tier) {
      query = query.eq("membership_tier_id", tier);
    }

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    const { data: members, error } = await query;

    if (error) {
      console.error("Members query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch members" },
        { status: 500 }
      );
    }

    const directoryMembers: DirectoryMember[] = (members ?? []).map((m) => {
      const tierData = m.membership_tiers as unknown as {
        name: string;
        level: string;
      } | null;
      return {
        id: m.id,
        member_number: m.member_number,
        first_name: m.first_name,
        last_name: m.last_name,
        email: m.email,
        phone: m.phone,
        avatar_url: m.avatar_url,
        role: m.role,
        status: m.status,
        join_date: m.join_date,
        tier_name: tierData?.name ?? null,
        tier_level: (tierData?.level as DirectoryMember["tier_level"]) ?? null,
      };
    });

    // Fetch tiers for filter dropdown
    const { data: tiers } = await supabase
      .from("membership_tiers")
      .select("id, name, level")
      .eq("club_id", result.member.club_id)
      .eq("is_active", true)
      .order("name", { ascending: true });

    return NextResponse.json({
      members: directoryMembers,
      tiers: tiers ?? [],
      role: result.member.role,
    });
  } catch (error) {
    console.error("Members API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

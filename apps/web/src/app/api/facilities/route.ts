import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";

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
    const type = searchParams.get("type");

    let query = supabase
      .from("facilities")
      .select("id, name, type, description, capacity, is_active")
      .eq("club_id", result.member.club_id)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (type) {
      query = query.eq("type", type);
    }

    const { data: facilities, error } = await query;

    if (error) {
      console.error("Facilities fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch facilities" },
        { status: 500 }
      );
    }

    return NextResponse.json({ facilities: facilities ?? [] });
  } catch (error) {
    console.error("Facilities API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

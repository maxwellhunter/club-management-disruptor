import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
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

    const { data: club, error } = await supabase
      .from("clubs")
      .select("events_image_url")
      .eq("id", result.member.club_id)
      .single();

    if (error) {
      console.error("Club events image fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch club" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      events_image_url: club?.events_image_url ?? null,
    });
  } catch (error) {
    console.error("Club events image API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
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

    if (result.member.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await request.json();
    const supabaseAdmin = getSupabaseAdmin();

    const { data: club, error } = await supabaseAdmin
      .from("clubs")
      .update({ events_image_url: body.events_image_url ?? null })
      .eq("id", result.member.club_id)
      .select("events_image_url")
      .single();

    if (error) {
      console.error("Club events image update error:", error);
      return NextResponse.json(
        { error: "Failed to update" },
        { status: 500 }
      );
    }

    return NextResponse.json({ events_image_url: club.events_image_url });
  } catch (error) {
    console.error("Club events image PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

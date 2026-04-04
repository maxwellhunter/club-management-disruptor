import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";

/**
 * GET /api/scorecards/course?facility_id=UUID
 * Returns course hole layout for a given golf facility.
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
    const facilityId = searchParams.get("facility_id");

    if (!facilityId) {
      return NextResponse.json(
        { error: "facility_id is required" },
        { status: 400 }
      );
    }

    // Fetch facility details
    const { data: facility, error: facilityError } = await supabase
      .from("facilities")
      .select("id, name, description, type")
      .eq("id", facilityId)
      .eq("club_id", result.member.club_id)
      .eq("type", "golf")
      .single();

    if (facilityError || !facility) {
      return NextResponse.json(
        { error: "Golf course not found" },
        { status: 404 }
      );
    }

    // Fetch hole layout
    const { data: holes, error: holesError } = await supabase
      .from("course_holes")
      .select("*")
      .eq("facility_id", facilityId)
      .order("hole_number", { ascending: true });

    if (holesError) {
      console.error("Course holes query error:", holesError);
      return NextResponse.json(
        { error: "Failed to fetch course layout" },
        { status: 500 }
      );
    }

    const holeData = holes ?? [];
    const totalPar = holeData.reduce((sum, h) => sum + h.par, 0);
    const totalYardage = {
      back: holeData.reduce((sum, h) => sum + (h.yardage_back ?? 0), 0),
      middle: holeData.reduce((sum, h) => sum + (h.yardage_middle ?? 0), 0),
      forward: holeData.reduce((sum, h) => sum + (h.yardage_forward ?? 0), 0),
    };

    return NextResponse.json({
      facility: {
        id: facility.id,
        name: facility.name,
        description: facility.description,
      },
      holes: holeData,
      total_par: totalPar,
      total_yardage: totalYardage,
    });
  } catch (error) {
    console.error("Course layout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { z } from "zod";

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

// ── Validation ──────────────────────────────────────────

const holeSchema = z.object({
  hole_number: z.number().int().min(1).max(18),
  par: z.number().int().min(3).max(6),
  yardage_back: z.number().int().positive(),
  yardage_middle: z.number().int().positive().nullable().optional(),
  yardage_forward: z.number().int().positive().nullable().optional(),
  handicap_index: z.number().int().min(1).max(18),
});

const upsertCourseSchema = z.object({
  facility_id: z.string().uuid(),
  holes: z.array(holeSchema).min(1).max(18),
});

/**
 * PUT /api/scorecards/course — Admin: create or update course hole layout.
 * Upserts holes by (facility_id, hole_number). Admins only.
 *
 * Body: { facility_id: UUID, holes: [{ hole_number, par, yardage_back, ... }] }
 */
export async function PUT(request: Request) {
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
      return NextResponse.json(
        { error: "Only admins can configure course layouts" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = upsertCourseSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    // Verify facility is a golf course in admin's club
    const { data: facility } = await supabase
      .from("facilities")
      .select("id, name, type")
      .eq("id", parsed.data.facility_id)
      .eq("club_id", result.member.club_id)
      .eq("type", "golf")
      .single();

    if (!facility) {
      return NextResponse.json(
        { error: "Golf course not found in your club" },
        { status: 404 }
      );
    }

    // Validate no duplicate hole numbers
    const holeNums = parsed.data.holes.map((h) => h.hole_number);
    if (new Set(holeNums).size !== holeNums.length) {
      return NextResponse.json(
        { error: "Duplicate hole numbers" },
        { status: 400 }
      );
    }

    // Validate handicap indexes are unique within the set
    const handicaps = parsed.data.holes.map((h) => h.handicap_index);
    if (new Set(handicaps).size !== handicaps.length) {
      return NextResponse.json(
        { error: "Duplicate handicap indexes — each hole needs a unique handicap ranking" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Upsert each hole (facility_id + hole_number is the unique constraint)
    for (const hole of parsed.data.holes) {
      const { error: upsertError } = await admin
        .from("course_holes")
        .upsert(
          {
            facility_id: parsed.data.facility_id,
            hole_number: hole.hole_number,
            par: hole.par,
            yardage_back: hole.yardage_back,
            yardage_middle: hole.yardage_middle ?? null,
            yardage_forward: hole.yardage_forward ?? null,
            handicap_index: hole.handicap_index,
          },
          { onConflict: "facility_id,hole_number" }
        );

      if (upsertError) {
        console.error("Upsert hole error:", upsertError);
        return NextResponse.json(
          { error: `Failed to save hole ${hole.hole_number}` },
          { status: 500 }
        );
      }
    }

    // Return the updated course layout
    const { data: holes } = await admin
      .from("course_holes")
      .select("*")
      .eq("facility_id", parsed.data.facility_id)
      .order("hole_number", { ascending: true });

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
      },
      holes: holeData,
      total_par: totalPar,
      total_yardage: totalYardage,
    });
  } catch (error) {
    console.error("Course setup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

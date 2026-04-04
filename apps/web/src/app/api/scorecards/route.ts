import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { createGolfRoundSchema, submitScoresSchema } from "@club/shared";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/scorecards — List golf rounds.
 * Members see own rounds; admins see all club rounds.
 * Query params: ?limit=20&offset=0&facility_id=UUID
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
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const facilityId = searchParams.get("facility_id");
    const isAdmin = result.member.role === "admin";

    let query = supabase
      .from("golf_rounds")
      .select(
        `
        *,
        facilities!inner(name),
        members!inner(first_name, last_name)
      `
      )
      .eq("club_id", result.member.club_id)
      .order("played_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Members only see their own rounds
    if (!isAdmin) {
      query = query.eq("member_id", result.member.id);
    }

    if (facilityId) {
      query = query.eq("facility_id", facilityId);
    }

    const { data: rounds, error } = await query;

    if (error) {
      console.error("Golf rounds query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch rounds" },
        { status: 500 }
      );
    }

    // Get course pars for score-to-par calculation
    const facilityIds = [
      ...new Set((rounds ?? []).map((r) => r.facility_id)),
    ];
    const coursePars: Record<string, number> = {};
    if (facilityIds.length > 0) {
      const { data: holes } = await supabase
        .from("course_holes")
        .select("facility_id, par")
        .in("facility_id", facilityIds);

      for (const fid of facilityIds) {
        const courseHoles = (holes ?? []).filter(
          (h) => h.facility_id === fid
        );
        coursePars[fid] = courseHoles.reduce((sum, h) => sum + h.par, 0);
      }
    }

    // Fetch golf facilities for filtering
    const { data: facilities } = await supabase
      .from("facilities")
      .select("id, name")
      .eq("club_id", result.member.club_id)
      .eq("type", "golf")
      .eq("is_active", true);

    const formatted = (rounds ?? []).map((r: Record<string, unknown>) => {
      const fac = r.facilities as { name: string } | null;
      const mem = r.members as {
        first_name: string;
        last_name: string;
      } | null;
      const coursePar = coursePars[r.facility_id as string] ?? null;
      const totalScore = r.total_score as number | null;
      const holesPlayed = r.holes_played as number;

      // Adjust par for 9-hole rounds on 18-hole courses
      let adjustedPar = coursePar;
      if (coursePar && holesPlayed === 9 && coursePar > 45) {
        adjustedPar = Math.round(coursePar / 2);
      }

      return {
        id: r.id,
        club_id: r.club_id,
        facility_id: r.facility_id,
        member_id: r.member_id,
        booking_id: r.booking_id,
        played_at: r.played_at,
        tee_set: r.tee_set,
        holes_played: holesPlayed,
        total_score: totalScore,
        total_putts: r.total_putts,
        total_fairways_hit: r.total_fairways_hit,
        total_greens_in_regulation: r.total_greens_in_regulation,
        weather: r.weather,
        notes: r.notes,
        status: r.status,
        completed_at: r.completed_at,
        created_at: r.created_at,
        updated_at: r.updated_at,
        facility_name: fac?.name ?? "Unknown",
        member_first_name: mem?.first_name ?? "",
        member_last_name: mem?.last_name ?? "",
        course_par: adjustedPar,
        score_to_par:
          totalScore != null && adjustedPar != null
            ? totalScore - adjustedPar
            : null,
      };
    });

    return NextResponse.json({
      rounds: formatted,
      facilities: facilities ?? [],
      role: result.member.role,
    });
  } catch (error) {
    console.error("Golf rounds error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/scorecards — Start a new golf round.
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
    if (!result) {
      return NextResponse.json(
        { error: "Member not found" },
        { status: 404 }
      );
    }

    if (!result.isGolfEligible) {
      return NextResponse.json(
        { error: "Golf access requires a Golf, Platinum, or Legacy membership" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createGolfRoundSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    // Verify it's a golf facility in their club
    const { data: facility } = await supabase
      .from("facilities")
      .select("id, name, type")
      .eq("id", parsed.data.facility_id)
      .eq("club_id", result.member.club_id)
      .eq("type", "golf")
      .single();

    if (!facility) {
      return NextResponse.json(
        { error: "Golf course not found" },
        { status: 404 }
      );
    }

    // Verify course has holes defined
    const { count } = await supabase
      .from("course_holes")
      .select("id", { count: "exact", head: true })
      .eq("facility_id", parsed.data.facility_id);

    if (!count || count === 0) {
      return NextResponse.json(
        { error: "Course layout not configured" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    const { data: round, error } = await admin
      .from("golf_rounds")
      .insert({
        club_id: result.member.club_id,
        facility_id: parsed.data.facility_id,
        member_id: result.member.id,
        booking_id: parsed.data.booking_id ?? null,
        played_at: parsed.data.played_at,
        tee_set: parsed.data.tee_set ?? "middle",
        holes_played: parsed.data.holes_played ?? 18,
        weather: parsed.data.weather ?? null,
        notes: parsed.data.notes ?? null,
        status: "in_progress",
      })
      .select()
      .single();

    if (error) {
      console.error("Create round error:", error);
      return NextResponse.json(
        { error: "Failed to create round" },
        { status: 500 }
      );
    }

    return NextResponse.json({ round }, { status: 201 });
  } catch (error) {
    console.error("Create round error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

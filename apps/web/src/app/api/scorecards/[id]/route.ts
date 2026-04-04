import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { submitScoresSchema } from "@club/shared";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/scorecards/[id] — Get a round with all scores and course layout.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Fetch the round
    const { data: round, error: roundError } = await supabase
      .from("golf_rounds")
      .select(
        `
        *,
        facilities!inner(name),
        members!inner(first_name, last_name)
      `
      )
      .eq("id", id)
      .single();

    if (roundError || !round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    // Check access: own round or admin
    if (!isAdmin && round.member_id !== result.member.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Fetch scores
    const { data: scores } = await supabase
      .from("golf_scores")
      .select("*")
      .eq("round_id", id)
      .order("hole_number", { ascending: true });

    // Fetch course holes
    const { data: holes } = await supabase
      .from("course_holes")
      .select("*")
      .eq("facility_id", round.facility_id)
      .order("hole_number", { ascending: true });

    const fac = round.facilities as { name: string };
    const mem = round.members as { first_name: string; last_name: string };

    return NextResponse.json({
      round: {
        id: round.id,
        club_id: round.club_id,
        facility_id: round.facility_id,
        member_id: round.member_id,
        booking_id: round.booking_id,
        played_at: round.played_at,
        tee_set: round.tee_set,
        holes_played: round.holes_played,
        total_score: round.total_score,
        total_putts: round.total_putts,
        total_fairways_hit: round.total_fairways_hit,
        total_greens_in_regulation: round.total_greens_in_regulation,
        weather: round.weather,
        notes: round.notes,
        status: round.status,
        completed_at: round.completed_at,
        created_at: round.created_at,
        updated_at: round.updated_at,
        facility_name: fac.name,
        member_first_name: mem.first_name,
        member_last_name: mem.last_name,
      },
      scores: scores ?? [],
      holes: holes ?? [],
    });
  } catch (error) {
    console.error("Get round error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/scorecards/[id] — Update scores for a round.
 * Body: { scores: [{ hole_number, strokes, putts, ... }] }
 * Or: { action: "complete" | "cancel" }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // Verify ownership or admin
    const { data: round } = await supabase
      .from("golf_rounds")
      .select("id, member_id, status, facility_id, holes_played")
      .eq("id", id)
      .single();

    if (!round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    const isAdmin = result.member.role === "admin";
    if (!isAdmin && round.member_id !== result.member.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const body = await request.json();
    const admin = getSupabaseAdmin();

    // Handle status actions
    if (body.action === "complete") {
      if (round.status !== "in_progress") {
        return NextResponse.json(
          { error: "Round is not in progress" },
          { status: 400 }
        );
      }

      // Calculate totals from existing scores
      const { data: scores } = await supabase
        .from("golf_scores")
        .select("strokes, putts, fairway_hit, green_in_regulation")
        .eq("round_id", id);

      const allScores = scores ?? [];
      const totalScore = allScores.reduce(
        (sum, s) => sum + (s.strokes ?? 0),
        0
      );
      const totalPutts = allScores.reduce(
        (sum, s) => sum + (s.putts ?? 0),
        0
      );
      const totalFairways = allScores.filter((s) => s.fairway_hit === true).length;
      const totalGir = allScores.filter(
        (s) => s.green_in_regulation === true
      ).length;

      const { data: updated, error } = await admin
        .from("golf_rounds")
        .update({
          status: "completed",
          total_score: totalScore || null,
          total_putts: totalPutts || null,
          total_fairways_hit: totalFairways,
          total_greens_in_regulation: totalGir,
          completed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Complete round error:", error);
        return NextResponse.json(
          { error: "Failed to complete round" },
          { status: 500 }
        );
      }

      return NextResponse.json({ round: updated });
    }

    if (body.action === "cancel") {
      const { data: updated, error } = await admin
        .from("golf_rounds")
        .update({ status: "cancelled" })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: "Failed to cancel round" },
          { status: 500 }
        );
      }

      return NextResponse.json({ round: updated });
    }

    // Handle score updates
    if (body.scores) {
      if (round.status !== "in_progress") {
        return NextResponse.json(
          { error: "Cannot update scores on a completed round" },
          { status: 400 }
        );
      }

      const parsed = submitScoresSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.errors[0].message },
          { status: 400 }
        );
      }

      // Upsert scores (insert or update by round_id + hole_number)
      for (const score of parsed.data.scores) {
        const { error: upsertError } = await admin
          .from("golf_scores")
          .upsert(
            {
              round_id: id,
              hole_number: score.hole_number,
              strokes: score.strokes ?? null,
              putts: score.putts ?? null,
              fairway_hit: score.fairway_hit ?? null,
              green_in_regulation: score.green_in_regulation ?? null,
              penalty_strokes: score.penalty_strokes ?? 0,
            },
            { onConflict: "round_id,hole_number" }
          );

        if (upsertError) {
          console.error("Upsert score error:", upsertError);
          return NextResponse.json(
            { error: `Failed to save score for hole ${score.hole_number}` },
            { status: 500 }
          );
        }
      }

      // Re-fetch updated scores
      const { data: updatedScores } = await supabase
        .from("golf_scores")
        .select("*")
        .eq("round_id", id)
        .order("hole_number", { ascending: true });

      return NextResponse.json({ scores: updatedScores ?? [] });
    }

    // Handle round metadata updates (weather, notes, tee_set)
    const updateFields: Record<string, unknown> = {};
    if (body.weather) updateFields.weather = body.weather;
    if (body.notes !== undefined) updateFields.notes = body.notes;
    if (body.tee_set) updateFields.tee_set = body.tee_set;

    if (Object.keys(updateFields).length > 0) {
      const { data: updated, error } = await admin
        .from("golf_rounds")
        .update(updateFields)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        return NextResponse.json(
          { error: "Failed to update round" },
          { status: 500 }
        );
      }

      return NextResponse.json({ round: updated });
    }

    return NextResponse.json({ error: "No valid update provided" }, { status: 400 });
  } catch (error) {
    console.error("Update round error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/scorecards/[id] — Delete a round (admin or owner of in-progress rounds).
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const { data: round } = await supabase
      .from("golf_rounds")
      .select("id, member_id, status")
      .eq("id", id)
      .single();

    if (!round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }

    const isAdmin = result.member.role === "admin";
    if (!isAdmin && round.member_id !== result.member.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Only allow deleting in-progress or cancelled rounds (unless admin)
    if (!isAdmin && round.status === "completed") {
      return NextResponse.json(
        { error: "Cannot delete a completed round" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Delete scores first, then round
    await admin.from("golf_scores").delete().eq("round_id", id);
    const { error } = await admin.from("golf_rounds").delete().eq("id", id);

    if (error) {
      console.error("Delete round error:", error);
      return NextResponse.json(
        { error: "Failed to delete round" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete round error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

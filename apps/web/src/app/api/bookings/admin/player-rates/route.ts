import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { createGolfPlayerRateSchema, updateGolfPlayerRateSchema } from "@club/shared";

/**
 * GET /api/bookings/admin/player-rates
 * Returns all golf_player_rates for the admin's club,
 * joined with facility names and tier names.
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

    // Fetch player rates with facility and tier names
    const { data: rates, error } = await supabase
      .from("golf_player_rates")
      .select(
        `
        *,
        facilities (name),
        membership_tiers (name, level)
      `
      )
      .eq("club_id", result.member.club_id)
      .order("facility_id")
      .order("is_guest")
      .order("day_type")
      .order("time_type")
      .order("holes");

    if (error) {
      console.error("Player rates fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch player rates" },
        { status: 500 }
      );
    }

    // Fetch golf facilities for the dropdown
    const { data: facilities } = await supabase
      .from("facilities")
      .select("id, name")
      .eq("club_id", result.member.club_id)
      .eq("type", "golf")
      .eq("is_active", true)
      .order("name");

    // Fetch membership tiers for the dropdown
    const { data: tiers } = await supabase
      .from("membership_tiers")
      .select("id, name, level")
      .eq("club_id", result.member.club_id)
      .eq("is_active", true)
      .order("name");

    const formattedRates = (rates ?? []).map((r) => ({
      ...r,
      facility_name:
        (r.facilities as unknown as { name: string })?.name ?? "Unknown",
      tier_name:
        (r.membership_tiers as unknown as { name: string; level: string })
          ?.name ?? null,
      facilities: undefined,
      membership_tiers: undefined,
    }));

    return NextResponse.json({
      rates: formattedRates,
      facilities: facilities ?? [],
      tiers: tiers ?? [],
      role: result.member.role,
    });
  } catch (error) {
    console.error("Player rates API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bookings/admin/player-rates
 * Create a new player rate. Admin only.
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

    if (result.member.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createGolfPlayerRateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verify facility belongs to admin's club and is a golf facility
    const { data: facility } = await supabase
      .from("facilities")
      .select("id, type")
      .eq("id", parsed.data.facility_id)
      .eq("club_id", result.member.club_id)
      .eq("type", "golf")
      .single();

    if (!facility) {
      return NextResponse.json(
        { error: "Golf facility not found" },
        { status: 404 }
      );
    }

    // If tier_id provided, verify it belongs to the club
    if (parsed.data.tier_id) {
      const { data: tier } = await supabase
        .from("membership_tiers")
        .select("id")
        .eq("id", parsed.data.tier_id)
        .eq("club_id", result.member.club_id)
        .single();

      if (!tier) {
        return NextResponse.json(
          { error: "Membership tier not found" },
          { status: 404 }
        );
      }
    }

    const { data: rate, error } = await supabase
      .from("golf_player_rates")
      .insert({
        ...parsed.data,
        tier_id: parsed.data.tier_id ?? null,
        club_id: result.member.club_id,
      })
      .select()
      .single();

    if (error) {
      // Unique constraint violation
      if (error.code === "23505") {
        return NextResponse.json(
          {
            error:
              "A rate already exists for this tier/guest + facility + day/time/holes combination",
          },
          { status: 409 }
        );
      }
      console.error("Player rate insert error:", error);
      return NextResponse.json(
        { error: "Failed to create player rate" },
        { status: 500 }
      );
    }

    return NextResponse.json({ rate }, { status: 201 });
  } catch (error) {
    console.error("Player rates API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/bookings/admin/player-rates
 * Update an existing player rate. Admin only.
 */
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
    const parsed = updateGolfPlayerRateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id, ...updates } = parsed.data;

    const { data: rate, error } = await supabase
      .from("golf_player_rates")
      .update(updates)
      .eq("id", id)
      .eq("club_id", result.member.club_id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          {
            error:
              "A rate already exists for this tier/guest + facility + day/time/holes combination",
          },
          { status: 409 }
        );
      }
      console.error("Player rate update error:", error);
      return NextResponse.json(
        { error: "Failed to update player rate" },
        { status: 500 }
      );
    }

    return NextResponse.json({ rate });
  } catch (error) {
    console.error("Player rates API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bookings/admin/player-rates?id=...
 * Delete a player rate. Admin only.
 */
export async function DELETE(request: Request) {
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

    const { searchParams } = new URL(request.url);
    const rateId = searchParams.get("id");

    if (!rateId) {
      return NextResponse.json(
        { error: "Rate id is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("golf_player_rates")
      .delete()
      .eq("id", rateId)
      .eq("club_id", result.member.club_id);

    if (error) {
      console.error("Player rate delete error:", error);
      return NextResponse.json(
        { error: "Failed to delete player rate" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Player rate deleted" });
  } catch (error) {
    console.error("Player rates API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

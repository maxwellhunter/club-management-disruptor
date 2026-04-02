import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { createGolfRateSchema, updateGolfRateSchema } from "@club/shared";

/**
 * GET /api/bookings/admin/golf-rates
 * Returns all golf rates for the admin's club, with facility names.
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

    // Fetch golf rates with facility name
    const { data: rates, error } = await supabase
      .from("golf_rates")
      .select(
        `
        *,
        facilities (name)
      `
      )
      .eq("club_id", result.member.club_id)
      .order("facility_id")
      .order("day_type")
      .order("time_type")
      .order("holes");

    if (error) {
      console.error("Golf rates fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch golf rates" },
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

    const formattedRates = (rates ?? []).map((r) => ({
      ...r,
      facility_name:
        (r.facilities as unknown as { name: string })?.name ?? "Unknown",
      facilities: undefined,
    }));

    return NextResponse.json({
      rates: formattedRates,
      facilities: facilities ?? [],
      role: result.member.role,
    });
  } catch (error) {
    console.error("Golf rates API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/bookings/admin/golf-rates
 * Create a new golf rate. Admin only.
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
    const parsed = createGolfRateSchema.safeParse(body);
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

    const { data: rate, error } = await supabase
      .from("golf_rates")
      .insert({
        ...parsed.data,
        club_id: result.member.club_id,
      })
      .select()
      .single();

    if (error) {
      console.error("Golf rate insert error:", error);
      return NextResponse.json(
        { error: "Failed to create golf rate" },
        { status: 500 }
      );
    }

    return NextResponse.json({ rate }, { status: 201 });
  } catch (error) {
    console.error("Golf rates API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/bookings/admin/golf-rates
 * Update an existing golf rate. Admin only.
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
    const parsed = updateGolfRateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { id, ...updates } = parsed.data;

    const { data: rate, error } = await supabase
      .from("golf_rates")
      .update(updates)
      .eq("id", id)
      .eq("club_id", result.member.club_id)
      .select()
      .single();

    if (error) {
      console.error("Golf rate update error:", error);
      return NextResponse.json(
        { error: "Failed to update golf rate" },
        { status: 500 }
      );
    }

    return NextResponse.json({ rate });
  } catch (error) {
    console.error("Golf rates API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/bookings/admin/golf-rates?id=...
 * Delete a golf rate. Admin only.
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
      .from("golf_rates")
      .delete()
      .eq("id", rateId)
      .eq("club_id", result.member.club_id);

    if (error) {
      console.error("Golf rate delete error:", error);
      return NextResponse.json(
        { error: "Failed to delete golf rate" },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Rate deleted" });
  } catch (error) {
    console.error("Golf rates API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

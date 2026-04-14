import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { facilityTypes } from "@club/shared";
import { z } from "zod";

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
    const typesParam = searchParams.get("types");
    const includeInactive = searchParams.get("include_inactive") === "true";

    let query = supabase
      .from("facilities")
      .select("id, name, type, description, capacity, is_active, image_url, max_party_size")
      .eq("club_id", result.member.club_id)
      .order("name", { ascending: true });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    if (typesParam) {
      const list = typesParam.split(",").map((t) => t.trim()).filter(Boolean);
      query = query.in("type", list);
    } else if (type) {
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

const createFacilitySchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(facilityTypes),
  description: z.string().max(2000).optional().nullable(),
  capacity: z.number().int().min(1).max(10000).optional().nullable(),
  max_party_size: z.number().int().min(1).max(100).optional(),
  image_url: z.string().url().optional().nullable(),
});

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
    const parsed = createFacilitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data: facility, error } = await supabaseAdmin
      .from("facilities")
      .insert({
        club_id: result.member.club_id,
        name: parsed.data.name,
        type: parsed.data.type,
        description: parsed.data.description ?? null,
        capacity: parsed.data.capacity ?? null,
        max_party_size: parsed.data.max_party_size ?? null,
        image_url: parsed.data.image_url ?? null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Facility create error:", error);
      return NextResponse.json(
        { error: "Failed to create facility" },
        { status: 500 }
      );
    }

    return NextResponse.json({ facility }, { status: 201 });
  } catch (error) {
    console.error("Facility POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

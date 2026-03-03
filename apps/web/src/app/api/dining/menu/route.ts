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
    const facility_id = searchParams.get("facility_id");

    if (!facility_id) {
      return NextResponse.json(
        { error: "facility_id is required" },
        { status: 400 }
      );
    }

    // Verify facility belongs to user's club
    const { data: facility } = await supabase
      .from("facilities")
      .select("id, name, type")
      .eq("id", facility_id)
      .eq("club_id", result.member.club_id)
      .eq("is_active", true)
      .single();

    if (!facility) {
      return NextResponse.json(
        { error: "Facility not found" },
        { status: 404 }
      );
    }

    // Fetch active categories with available items
    const { data: categories } = await supabase
      .from("menu_categories")
      .select("*")
      .eq("facility_id", facility_id)
      .eq("club_id", result.member.club_id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (!categories || categories.length === 0) {
      return NextResponse.json({
        facility: { id: facility.id, name: facility.name, type: facility.type },
        categories: [],
      });
    }

    // Fetch available items for all categories
    const categoryIds = categories.map((c) => c.id);
    const { data: items } = await supabase
      .from("menu_items")
      .select("*")
      .in("category_id", categoryIds)
      .eq("club_id", result.member.club_id)
      .eq("is_available", true)
      .order("sort_order", { ascending: true });

    // Group items by category
    const itemsByCategory: Record<string, NonNullable<typeof items>> = {};
    for (const item of items ?? []) {
      if (!itemsByCategory[item.category_id]) {
        itemsByCategory[item.category_id] = [];
      }
      itemsByCategory[item.category_id]!.push(item);
    }

    const categoriesWithItems = categories.map((cat) => ({
      ...cat,
      items: itemsByCategory[cat.id] ?? [],
    }));

    return NextResponse.json({
      facility: { id: facility.id, name: facility.name, type: facility.type },
      categories: categoriesWithItems,
    });
  } catch (error) {
    console.error("Menu API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

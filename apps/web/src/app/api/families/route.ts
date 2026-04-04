import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { createFamilySchema } from "@club/shared";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * GET /api/families — List all families in the club with member details.
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

    const clubId = result.member.club_id;
    const isAdmin = result.member.role === "admin";

    // Fetch all families
    const { data: families, error: famError } = await supabase
      .from("families")
      .select("id, club_id, name, primary_member_id, created_at")
      .eq("club_id", clubId)
      .order("name", { ascending: true });

    if (famError) {
      console.error("Families query error:", famError);
      return NextResponse.json(
        { error: "Failed to fetch families" },
        { status: 500 }
      );
    }

    // Fetch all members with family_id set (to build member lists)
    const { data: membersWithFamily } = await supabase
      .from("members")
      .select(
        `id, first_name, last_name, email, role, status, family_id,
         membership_tiers ( name )`
      )
      .eq("club_id", clubId)
      .not("family_id", "is", null)
      .order("last_name", { ascending: true });

    // Build family → members map
    const membersByFamily = new Map<string, typeof membersWithFamily>();
    for (const m of membersWithFamily ?? []) {
      if (!m.family_id) continue;
      const arr = membersByFamily.get(m.family_id) ?? [];
      arr.push(m);
      membersByFamily.set(m.family_id, arr);
    }

    const familiesWithMembers = (families ?? []).map((f) => {
      const members = (membersByFamily.get(f.id) ?? []).map((m) => {
        const tier = m.membership_tiers as unknown as { name: string } | null;
        return {
          id: m.id,
          first_name: m.first_name,
          last_name: m.last_name,
          email: m.email,
          role: m.role,
          status: m.status,
          tier_name: tier?.name ?? null,
          is_primary: m.id === f.primary_member_id,
        };
      });
      return {
        ...f,
        members,
        member_count: members.length,
      };
    });

    // Also get unassigned members for the "add to family" picker
    let unassignedMembers: { id: string; first_name: string; last_name: string; email: string }[] = [];
    if (isAdmin) {
      const { data: unassigned } = await supabase
        .from("members")
        .select("id, first_name, last_name, email")
        .eq("club_id", clubId)
        .is("family_id", null)
        .in("status", ["active", "invited", "pending"])
        .order("last_name", { ascending: true });
      unassignedMembers = unassigned ?? [];
    }

    return NextResponse.json({
      families: familiesWithMembers,
      unassigned_members: unassignedMembers,
      role: result.member.role,
    });
  } catch (error) {
    console.error("Families error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/families — Create a new family (admin only).
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
    if (!result || result.member.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = createFamilySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    const { data: family, error } = await admin
      .from("families")
      .insert({
        club_id: result.member.club_id,
        name: parsed.data.name,
        primary_member_id: parsed.data.primary_member_id ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error("Create family error:", error);
      return NextResponse.json(
        { error: "Failed to create family" },
        { status: 500 }
      );
    }

    // If primary_member_id was set, assign that member to this family
    if (parsed.data.primary_member_id) {
      await admin
        .from("members")
        .update({ family_id: family.id })
        .eq("id", parsed.data.primary_member_id);
    }

    return NextResponse.json({ family }, { status: 201 });
  } catch (error) {
    console.error("Create family error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

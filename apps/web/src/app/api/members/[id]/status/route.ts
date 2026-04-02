import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { z } from "zod";

const statusSchema = z.object({
  status: z.enum(["active", "inactive", "suspended", "pending"]),
});

/**
 * PATCH /api/members/[id]/status — Change a member's status (admin only).
 * Supports: active, inactive, suspended, pending.
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

    const caller = await getMemberWithTier(supabase, user.id);
    if (!caller || caller.member.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Prevent admin from deactivating themselves
    if (caller.member.id === id) {
      return NextResponse.json(
        { error: "You cannot change your own status" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid status. Must be: active, inactive, suspended, or pending" },
        { status: 400 }
      );
    }

    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: updated, error } = await adminClient
      .from("members")
      .update({ status: parsed.data.status })
      .eq("id", id)
      .eq("club_id", caller.member.club_id)
      .select("id, status, first_name, last_name")
      .single();

    if (error) {
      console.error("Status update error:", error);
      return NextResponse.json(
        { error: "Failed to update member status" },
        { status: 500 }
      );
    }

    return NextResponse.json({ member: updated });
  } catch (error) {
    console.error("Status update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

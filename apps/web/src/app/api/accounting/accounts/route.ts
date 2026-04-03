import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { createGLAccountSchema } from "@club/shared";

/**
 * POST /api/accounting/accounts — Create a GL account.
 * Admin only.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getMemberWithTier(supabase, user.id);
    if (!result || result.member.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createGLAccountSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("gl_accounts")
      .insert({ ...parsed.data, club_id: result.member.club_id })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Account number already exists" }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ account: data }, { status: 201 });
  } catch (error) {
    console.error("GL account POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

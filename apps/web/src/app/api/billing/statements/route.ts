import { NextResponse } from "next/server";
import { createApiClient } from "@/lib/supabase/api";
import { getMemberWithTier } from "@/lib/golf-eligibility";
import { generateStatements, previewStatements } from "@/lib/billing/statement-generator";

/**
 * GET /api/billing/statements?period=2026-04
 * Returns statement runs and optionally a preview for a period.
 * Query params:
 *   period — YYYY-MM (required)
 *   preview — "true" to get an estimate without generating
 */
export async function GET(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getMemberWithTier(supabase, user.id);
    if (!result) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    if (result.member.role === "member") {
      return NextResponse.json({ error: "Forbidden — admin/staff only" }, { status: 403 });
    }

    const url = new URL(request.url);
    const period = url.searchParams.get("period");
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ error: "period parameter required (YYYY-MM)" }, { status: 400 });
    }

    const isPreview = url.searchParams.get("preview") === "true";

    if (isPreview) {
      const preview = await previewStatements(supabase, result.member.club_id, period);
      return NextResponse.json({ preview });
    }

    // Return existing statement runs for this period
    const { data: runs } = await supabase
      .from("monthly_statements")
      .select("*")
      .eq("club_id", result.member.club_id)
      .eq("period", period)
      .order("created_at", { ascending: false });

    // If a run exists, also fetch member statements
    let memberStatements = null;
    if (runs && runs.length > 0) {
      const latestRun = runs[0];
      const { data: stmts } = await supabase
        .from("member_statements")
        .select(`
          *,
          members:member_id (first_name, last_name, email, member_number, membership_tiers(name))
        `)
        .eq("statement_run_id", latestRun.id)
        .order("total_due", { ascending: false });

      memberStatements = (stmts ?? []).map((s) => {
        const member = s.members as unknown as {
          first_name: string;
          last_name: string;
          email: string;
          member_number: string | null;
          membership_tiers: { name: string } | null;
        };
        return {
          ...s,
          member_name: `${member?.first_name ?? ""} ${member?.last_name ?? ""}`.trim(),
          member_email: member?.email ?? "",
          member_number: member?.member_number ?? null,
          tier_name: (member?.membership_tiers as unknown as { name: string } | null)?.name ?? null,
          members: undefined,
        };
      });
    }

    return NextResponse.json({
      runs: runs ?? [],
      member_statements: memberStatements,
    });
  } catch (error) {
    console.error("GET /api/billing/statements error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/billing/statements
 * Trigger statement generation for a period.
 * Body: { period: "2026-04", send_emails?: boolean }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getMemberWithTier(supabase, user.id);
    if (!result) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    if (result.member.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    const body = await request.json();
    const period = body.period;
    const sendEmails = body.send_emails === true;

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ error: "period required (YYYY-MM)" }, { status: 400 });
    }

    const runResult = await generateStatements(supabase, {
      clubId: result.member.club_id,
      period,
      runBy: result.member.id,
      sendEmails,
    });

    return NextResponse.json(
      {
        run_id: runResult.runId,
        members_processed: runResult.membersProcessed,
        statements_sent: runResult.statementsSent,
        total_amount: runResult.totalAmount,
        errors: runResult.errors,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    const status = message.includes("already generated") ? 409 : 500;
    console.error("POST /api/billing/statements error:", error);
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * DELETE /api/billing/statements?period=2026-04
 * Delete a statement run (allows re-generation).
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createApiClient(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const result = await getMemberWithTier(supabase, user.id);
    if (!result) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    if (result.member.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 });
    }

    const url = new URL(request.url);
    const period = url.searchParams.get("period");
    if (!period) {
      return NextResponse.json({ error: "period parameter required" }, { status: 400 });
    }

    // Delete member statements first (cascade should handle it, but be explicit)
    const { data: run } = await supabase
      .from("monthly_statements")
      .select("id")
      .eq("club_id", result.member.club_id)
      .eq("period", period)
      .single();

    if (!run) {
      return NextResponse.json({ error: "No statement run found for this period" }, { status: 404 });
    }

    await supabase
      .from("member_statements")
      .delete()
      .eq("statement_run_id", run.id);

    await supabase
      .from("monthly_statements")
      .delete()
      .eq("id", run.id);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("DELETE /api/billing/statements error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

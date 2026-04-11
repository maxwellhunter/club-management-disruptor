/**
 * Statement Generator — Generates monthly member statements
 *
 * A statement is NOT another invoice. It's a summary document showing:
 *   - Previous balance (unpaid invoices from prior periods)
 *   - Current month dues
 *   - Member charges (POS transactions)
 *   - Assessments
 *   - Credits / payments received
 *   - Total amount due
 *
 * The job:
 *   1. Finds all active members in the club
 *   2. Gathers all invoices + payments + charges for the period
 *   3. Calculates previous balance (overdue invoices from prior periods)
 *   4. Creates a member_statements record per member
 *   5. Optionally generates PDFs and sends emails
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { StatementLineItem } from "@club/shared";
import { sendStatementEmail } from "../email";

export interface StatementRunOptions {
  clubId: string;
  period: string; // YYYY-MM
  runBy: string; // member ID of admin triggering
  sendEmails?: boolean; // default: false (preview mode)
}

export interface StatementRunResult {
  runId: string;
  membersProcessed: number;
  statementsSent: number;
  totalAmount: number;
  errors: string[];
}

interface MemberRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  member_number: string | null;
  membership_tiers: { name: string } | null;
}

/** Parse a YYYY-MM period into start/end date strings */
function periodBounds(period: string): { start: string; end: string; label: string } {
  const [year, month] = period.split("-").map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // last day of month
  const label = startDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return {
    start: startDate.toISOString().split("T")[0],
    end: endDate.toISOString().split("T")[0],
    label,
  };
}

/** Main statement generation job */
export async function generateStatements(
  adminClient: SupabaseClient,
  options: StatementRunOptions
): Promise<StatementRunResult> {
  const { clubId, period, runBy, sendEmails = false } = options;
  const { start, end, label: periodLabel } = periodBounds(period);

  const result: StatementRunResult = {
    runId: "",
    membersProcessed: 0,
    statementsSent: 0,
    totalAmount: 0,
    errors: [],
  };

  // Create the statement run record
  const { data: run, error: runError } = await adminClient
    .from("monthly_statements")
    .insert({
      club_id: clubId,
      period,
      status: "running",
      run_by: runBy,
    })
    .select("id")
    .single();

  if (runError || !run) {
    // Could be a unique constraint violation (already generated)
    if (runError?.code === "23505") {
      throw new Error(`Statements already generated for ${periodLabel}. Delete the existing run first.`);
    }
    throw new Error(`Failed to create statement run: ${runError?.message}`);
  }

  result.runId = run.id;

  try {
    // 1. Get all active members
    const { data: members } = await adminClient
      .from("members")
      .select("id, first_name, last_name, email, member_number, membership_tiers(name)")
      .eq("club_id", clubId)
      .eq("status", "active")
      .order("last_name", { ascending: true });

    if (!members || members.length === 0) {
      result.errors.push("No active members found");
      await finalizeRun(adminClient, run.id, result, "completed");
      return result;
    }

    // 2. Get all invoices for this period (by created_at range)
    const { data: periodInvoices } = await adminClient
      .from("invoices")
      .select("id, member_id, amount, status, description, created_at")
      .eq("club_id", clubId)
      .gte("created_at", `${start}T00:00:00`)
      .lte("created_at", `${end}T23:59:59`)
      .in("status", ["sent", "paid", "overdue"]);

    // 3. Get overdue invoices from prior periods (= previous balance)
    const { data: overdueInvoices } = await adminClient
      .from("invoices")
      .select("id, member_id, amount, status, description, due_date, created_at")
      .eq("club_id", clubId)
      .lt("created_at", `${start}T00:00:00`)
      .in("status", ["sent", "overdue"]);

    // 4. Get all payments received in this period
    const { data: periodPayments } = await adminClient
      .from("payments")
      .select("id, member_id, amount, description, created_at")
      .eq("club_id", clubId)
      .gte("created_at", `${start}T00:00:00`)
      .lte("created_at", `${end}T23:59:59`);

    // 5. Get billing credits applied in this period
    const { data: periodCredits } = await adminClient
      .from("billing_credits")
      .select("id, member_id, amount, reason, created_at")
      .eq("club_id", clubId)
      .gte("created_at", `${start}T00:00:00`)
      .lte("created_at", `${end}T23:59:59`);

    // 6. Get POS charges for this period (uninvoiced — these are direct charges)
    const { data: posCharges } = await adminClient
      .from("pos_transactions")
      .select("id, member_id, total, description, created_at, pos_configs(name)")
      .eq("club_id", clubId)
      .eq("billing_period", period)
      .eq("payment_method", "member_charge");

    // Get club info for emails
    const { data: club } = await adminClient
      .from("clubs")
      .select("name")
      .eq("id", clubId)
      .single();

    const clubName = club?.name ?? "Your Club";
    const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.VERCEL_URL ?? "https://clubos.app";

    // Build lookup maps by member
    const invoicesByMember = groupBy(periodInvoices ?? [], "member_id");
    const overdueByMember = groupBy(overdueInvoices ?? [], "member_id");
    const paymentsByMember = groupBy(periodPayments ?? [], "member_id");
    const creditsByMember = groupBy(periodCredits ?? [], "member_id");
    const chargesByMember = groupBy(posCharges ?? [], "member_id");

    // 7. Process each member
    for (const member of members) {
      try {
        const m = member as unknown as MemberRow;
        const tier = m.membership_tiers as unknown as { name: string } | null;

        const memberInvoices = invoicesByMember.get(m.id) ?? [];
        const memberOverdue = overdueByMember.get(m.id) ?? [];
        const memberPayments = paymentsByMember.get(m.id) ?? [];
        const memberCredits = creditsByMember.get(m.id) ?? [];
        const memberCharges = chargesByMember.get(m.id) ?? [];

        // Skip members with zero activity
        if (
          memberInvoices.length === 0 &&
          memberOverdue.length === 0 &&
          memberPayments.length === 0 &&
          memberCredits.length === 0 &&
          memberCharges.length === 0
        ) {
          continue;
        }

        // Build line items
        const lineItems: StatementLineItem[] = [];

        // Previous balance
        const previousBalance = memberOverdue.reduce(
          (sum: number, inv: { amount: number }) => sum + Number(inv.amount),
          0
        );
        if (previousBalance > 0) {
          lineItems.push({
            category: "previous_balance",
            description: `Previous balance (${memberOverdue.length} outstanding invoice${memberOverdue.length !== 1 ? "s" : ""})`,
            amount: previousBalance,
            date: start,
          });
        }

        // Categorize current period invoices
        let duesAmount = 0;
        let assessmentsAmount = 0;
        let chargesInvoicedAmount = 0;

        for (const inv of memberInvoices) {
          const desc = (inv.description ?? "").toLowerCase();
          const amt = Number(inv.amount);

          if (desc.includes("dues")) {
            duesAmount += amt;
            lineItems.push({
              category: "dues",
              description: inv.description,
              amount: amt,
              date: inv.created_at,
              invoice_id: inv.id,
            });
          } else if (desc.includes("assessment") || desc.includes("installment")) {
            assessmentsAmount += amt;
            lineItems.push({
              category: "assessment",
              description: inv.description,
              amount: amt,
              date: inv.created_at,
              invoice_id: inv.id,
            });
          } else {
            // Member charges that were already consolidated into invoices
            chargesInvoicedAmount += amt;
            lineItems.push({
              category: "charges",
              description: inv.description,
              amount: amt,
              date: inv.created_at,
              invoice_id: inv.id,
            });
          }
        }

        // POS charges not yet invoiced — count as charges
        let uninvoicedChargesAmount = 0;
        for (const charge of memberCharges) {
          const amt = Number(charge.total);
          const posConfig = charge.pos_configs as unknown as { name: string } | null;
          const locationName = posConfig?.name ?? "POS";
          uninvoicedChargesAmount += amt;
          lineItems.push({
            category: "charges",
            description: `${locationName}: ${charge.description ?? "Charge"}`,
            amount: amt,
            date: charge.created_at,
          });
        }

        const totalCharges = chargesInvoicedAmount + uninvoicedChargesAmount;

        // Credits
        let creditsAmount = 0;
        for (const credit of memberCredits) {
          const amt = Number(credit.amount);
          creditsAmount += amt;
          lineItems.push({
            category: "credit",
            description: credit.reason ?? "Account credit",
            amount: -amt, // negative = reduces balance
            date: credit.created_at,
          });
        }

        // Payments received
        for (const payment of memberPayments) {
          lineItems.push({
            category: "payment",
            description: payment.description ?? "Payment received",
            amount: -Number(payment.amount), // negative = reduces balance
            date: payment.created_at,
          });
          creditsAmount += Number(payment.amount);
        }

        // Calculate total due
        const totalDue =
          previousBalance + duesAmount + totalCharges + assessmentsAmount - creditsAmount;

        // Collect all invoice IDs
        const invoiceIds = [
          ...memberInvoices.map((i: { id: string }) => i.id),
          ...memberOverdue.map((i: { id: string }) => i.id),
        ];

        // Insert member statement record
        const { error: stmtError } = await adminClient
          .from("member_statements")
          .insert({
            statement_run_id: run.id,
            club_id: clubId,
            member_id: m.id,
            period,
            dues_amount: Math.round(duesAmount * 100) / 100,
            charges_amount: Math.round(totalCharges * 100) / 100,
            assessments_amount: Math.round(assessmentsAmount * 100) / 100,
            credits_amount: Math.round(creditsAmount * 100) / 100,
            previous_balance: Math.round(previousBalance * 100) / 100,
            total_due: Math.round(totalDue * 100) / 100,
            invoice_ids: invoiceIds,
          });

        if (stmtError) {
          result.errors.push(
            `Failed to create statement for ${m.first_name} ${m.last_name}: ${stmtError.message}`
          );
          continue;
        }

        result.membersProcessed++;
        result.totalAmount += Math.round(totalDue * 100) / 100;

        // Send email if requested
        if (sendEmails && m.email && totalDue !== 0) {
          const emailResult = await sendStatementEmail({
            to: m.email,
            memberName: `${m.first_name} ${m.last_name}`,
            clubName,
            period: periodLabel,
            previousBalance: Math.round(previousBalance * 100) / 100,
            duesAmount: Math.round(duesAmount * 100) / 100,
            chargesAmount: Math.round(totalCharges * 100) / 100,
            assessmentsAmount: Math.round(assessmentsAmount * 100) / 100,
            creditsAmount: Math.round(creditsAmount * 100) / 100,
            totalDue: Math.round(totalDue * 100) / 100,
            lineItems,
            dashboardUrl,
          });

          if (emailResult.success) {
            result.statementsSent++;
            // Update email_sent flag
            await adminClient
              .from("member_statements")
              .update({ email_sent: true, email_sent_at: new Date().toISOString() })
              .eq("statement_run_id", run.id)
              .eq("member_id", m.id);
          } else {
            result.errors.push(
              `Email failed for ${m.first_name} ${m.last_name}: ${emailResult.error}`
            );
          }
        }
      } catch (err) {
        const name = `${(member as unknown as MemberRow).first_name} ${(member as unknown as MemberRow).last_name}`;
        result.errors.push(
          `Error processing ${name}: ${err instanceof Error ? err.message : "Unknown"}`
        );
      }
    }

    await finalizeRun(adminClient, run.id, result, "completed");
    return result;
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : "Unknown error");
    await finalizeRun(adminClient, run.id, result, "failed");
    throw err;
  }
}

/** Get a preview of what statements would look like for a period */
export async function previewStatements(
  adminClient: SupabaseClient,
  clubId: string,
  period: string
): Promise<{
  memberCount: number;
  totalDues: number;
  totalCharges: number;
  totalAssessments: number;
  totalCredits: number;
  totalPreviousBalance: number;
  estimatedTotal: number;
}> {
  const { start, end } = periodBounds(period);

  // Count active members
  const { count: memberCount } = await adminClient
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("club_id", clubId)
    .eq("status", "active");

  // Sum invoices by type
  const { data: invoices } = await adminClient
    .from("invoices")
    .select("amount, description, status")
    .eq("club_id", clubId)
    .gte("created_at", `${start}T00:00:00`)
    .lte("created_at", `${end}T23:59:59`)
    .in("status", ["sent", "paid", "overdue"]);

  let totalDues = 0;
  let totalAssessments = 0;
  let totalOther = 0;

  for (const inv of invoices ?? []) {
    const desc = (inv.description ?? "").toLowerCase();
    const amt = Number(inv.amount);
    if (desc.includes("dues")) totalDues += amt;
    else if (desc.includes("assessment") || desc.includes("installment")) totalAssessments += amt;
    else totalOther += amt;
  }

  // Sum POS charges
  const { data: charges } = await adminClient
    .from("pos_transactions")
    .select("total")
    .eq("club_id", clubId)
    .eq("billing_period", period)
    .eq("payment_method", "member_charge");

  const totalCharges =
    totalOther + (charges ?? []).reduce((s, c) => s + Number(c.total), 0);

  // Sum credits
  const { data: credits } = await adminClient
    .from("billing_credits")
    .select("amount")
    .eq("club_id", clubId)
    .gte("created_at", `${start}T00:00:00`)
    .lte("created_at", `${end}T23:59:59`);

  const totalCredits = (credits ?? []).reduce((s, c) => s + Number(c.amount), 0);

  // Previous balance (overdue from prior)
  const { data: overdue } = await adminClient
    .from("invoices")
    .select("amount")
    .eq("club_id", clubId)
    .lt("created_at", `${start}T00:00:00`)
    .in("status", ["sent", "overdue"]);

  const totalPreviousBalance = (overdue ?? []).reduce((s, i) => s + Number(i.amount), 0);

  return {
    memberCount: memberCount ?? 0,
    totalDues: Math.round(totalDues * 100) / 100,
    totalCharges: Math.round(totalCharges * 100) / 100,
    totalAssessments: Math.round(totalAssessments * 100) / 100,
    totalCredits: Math.round(totalCredits * 100) / 100,
    totalPreviousBalance: Math.round(totalPreviousBalance * 100) / 100,
    estimatedTotal: Math.round(
      (totalPreviousBalance + totalDues + totalCharges + totalAssessments - totalCredits) * 100
    ) / 100,
  };
}

// ── Helpers ───────────────────────────────────────────

async function finalizeRun(
  adminClient: SupabaseClient,
  runId: string,
  result: StatementRunResult,
  status: "completed" | "failed"
) {
  await adminClient
    .from("monthly_statements")
    .update({
      status,
      members_processed: result.membersProcessed,
      statements_sent: result.statementsSent,
      total_amount: Math.round(result.totalAmount * 100) / 100,
      error_message: result.errors.length > 0 ? result.errors.join("\n") : null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

function groupBy<T extends Record<string, unknown>>(
  items: T[],
  key: string
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = item[key] as string;
    if (!k) continue;
    const group = map.get(k) ?? [];
    group.push(item);
    map.set(k, group);
  }
  return map;
}

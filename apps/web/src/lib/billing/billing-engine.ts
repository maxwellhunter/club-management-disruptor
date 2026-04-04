/**
 * Billing Engine — Generates invoices for dues, minimums shortfalls, and assessments
 *
 * This is the core automation that replaces manual billing in legacy systems.
 * Handles:
 * - Monthly/quarterly/annual dues generation per tier
 * - Minimum spending shortfall invoicing
 * - Assessment invoice generation (one-time + installments)
 * - Family billing consolidation
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingCycleType } from "@club/shared";
import { calculateAllSpendingTracking } from "./spending-tracker";

interface BillingCycleResult {
  invoicesCreated: number;
  totalAmount: number;
  errors: string[];
}

/** Run a dues billing cycle — generates invoices for all active members' tier dues */
export async function runDuesCycle(
  adminClient: SupabaseClient,
  clubId: string,
  periodStart: string,
  periodEnd: string,
  runBy: string
): Promise<BillingCycleResult> {
  const result: BillingCycleResult = { invoicesCreated: 0, totalAmount: 0, errors: [] };

  // Get all active members with their tier
  const { data: members } = await adminClient
    .from("members")
    .select("id, first_name, last_name, membership_tier_id, family_id, membership_tiers(name, monthly_dues)")
    .eq("club_id", clubId)
    .eq("status", "active")
    .not("membership_tier_id", "is", null);

  if (!members || members.length === 0) {
    result.errors.push("No active members with tiers found");
    return result;
  }

  // Check which members already have a dues invoice for this period
  const { data: existingInvoices } = await adminClient
    .from("invoices")
    .select("member_id")
    .eq("club_id", clubId)
    .like("description", "%Monthly Dues%")
    .gte("created_at", `${periodStart}T00:00:00`)
    .lte("created_at", `${periodEnd}T23:59:59`);

  const alreadyBilled = new Set(existingInvoices?.map((i) => i.member_id) ?? []);

  // Get families for consolidation
  const { data: families } = await adminClient
    .from("families")
    .select("id, primary_member_id, billing_consolidated")
    .eq("club_id", clubId)
    .eq("billing_consolidated", true);

  const consolidatedFamilies = new Map<string, string>();
  if (families) {
    for (const fam of families) {
      if (fam.primary_member_id) {
        consolidatedFamilies.set(fam.id, fam.primary_member_id);
      }
    }
  }

  // Track family-consolidated amounts
  const familyTotals = new Map<string, { amount: number; descriptions: string[] }>();

  for (const member of members) {
    if (alreadyBilled.has(member.id)) continue;

    const tiers = member.membership_tiers as unknown as { name: string; monthly_dues: number }[] | null;
    const tier = tiers?.[0];
    if (!tier || Number(tier.monthly_dues) <= 0) continue;

    const amount = Number(tier.monthly_dues);
    const desc = `Monthly Dues — ${tier.name} (${periodStart} to ${periodEnd})`;

    // If member is in a consolidated family and is NOT the primary, add to family total
    if (member.family_id && consolidatedFamilies.has(member.family_id)) {
      const primaryId = consolidatedFamilies.get(member.family_id)!;
      if (member.id !== primaryId) {
        const existing = familyTotals.get(primaryId) ?? { amount: 0, descriptions: [] };
        existing.amount += amount;
        existing.descriptions.push(`${member.first_name} ${member.last_name}: $${amount.toFixed(2)}`);
        familyTotals.set(primaryId, existing);
        continue; // Don't create individual invoice
      }
    }

    try {
      const { error } = await adminClient.from("invoices").insert({
        club_id: clubId,
        member_id: member.id,
        amount,
        description: desc,
        due_date: periodEnd,
        status: "sent",
      });

      if (error) {
        result.errors.push(`Failed to create invoice for ${member.first_name} ${member.last_name}: ${error.message}`);
      } else {
        result.invoicesCreated++;
        result.totalAmount += amount;
      }
    } catch (err) {
      result.errors.push(`Error invoicing ${member.id}: ${err instanceof Error ? err.message : "Unknown"}`);
    }
  }

  // Create consolidated family invoices
  for (const [primaryId, totals] of familyTotals) {
    // The primary member might also have their own dues
    const primaryMember = members.find((m) => m.id === primaryId);
    const primaryTiers = primaryMember?.membership_tiers as unknown as { name: string; monthly_dues: number }[] | null;
    const primaryTier = primaryTiers?.[0];

    let familyTotal = totals.amount;
    const descLines = [...totals.descriptions];

    if (primaryMember && primaryTier && Number(primaryTier.monthly_dues) > 0) {
      familyTotal += Number(primaryTier.monthly_dues);
      descLines.unshift(
        `${primaryMember.first_name} ${primaryMember.last_name}: $${Number(primaryTier.monthly_dues).toFixed(2)}`
      );
    }

    const desc = `Family Consolidated Dues (${periodStart} to ${periodEnd})\n${descLines.join("\n")}`;

    try {
      const { error } = await adminClient.from("invoices").insert({
        club_id: clubId,
        member_id: primaryId,
        amount: familyTotal,
        description: desc,
        due_date: periodEnd,
        status: "sent",
      });

      if (error) {
        result.errors.push(`Failed to create family invoice for primary ${primaryId}: ${error.message}`);
      } else {
        result.invoicesCreated++;
        result.totalAmount += familyTotal;
      }
    } catch (err) {
      result.errors.push(`Error invoicing family ${primaryId}: ${err instanceof Error ? err.message : "Unknown"}`);
    }
  }

  return result;
}

/** Run minimum spending shortfall cycle — invoices members who didn't meet minimums */
export async function runShortfallCycle(
  adminClient: SupabaseClient,
  clubId: string,
  periodStart: string,
  periodEnd: string,
  runBy: string
): Promise<BillingCycleResult> {
  const result: BillingCycleResult = { invoicesCreated: 0, totalAmount: 0, errors: [] };

  // Calculate all spending tracking
  const periodDate = new Date(periodEnd);
  const { tracked, errors: trackErrors } = await calculateAllSpendingTracking(
    adminClient,
    clubId,
    periodDate
  );

  result.errors.push(...trackErrors);

  // Get minimum details for descriptions
  const { data: minimums } = await adminClient
    .from("spending_minimums")
    .select("id, name, shortfall_description, enforce_shortfall")
    .eq("club_id", clubId)
    .eq("is_active", true);

  const minimumMap = new Map(minimums?.map((m) => [m.id, m]) ?? []);

  // Get member names
  const memberIds = [...new Set(tracked.filter((t) => t.shortfall > 0).map((t) => t.member_id))];
  const { data: memberNames } = await adminClient
    .from("members")
    .select("id, first_name, last_name")
    .in("id", memberIds.length > 0 ? memberIds : ["__none__"]);

  const nameMap = new Map(
    memberNames?.map((m) => [m.id, `${m.first_name} ${m.last_name}`]) ?? []
  );

  for (const track of tracked) {
    if (track.shortfall <= 0) continue;

    const minimum = minimumMap.get(track.minimum_id);
    if (!minimum?.enforce_shortfall) continue;

    // Upsert tracking record
    await adminClient.from("spending_tracking").upsert(
      {
        club_id: clubId,
        member_id: track.member_id,
        minimum_id: track.minimum_id,
        period_start: track.period_start,
        period_end: track.period_end,
        amount_spent: track.amount_spent,
        amount_required: track.amount_required,
        shortfall: track.shortfall,
      },
      { onConflict: "member_id,minimum_id,period_start" }
    );

    // Check if shortfall already invoiced
    const { data: existingTracking } = await adminClient
      .from("spending_tracking")
      .select("shortfall_invoiced")
      .eq("member_id", track.member_id)
      .eq("minimum_id", track.minimum_id)
      .eq("period_start", track.period_start)
      .maybeSingle();

    if (existingTracking?.shortfall_invoiced) continue;

    const desc = `${minimum.shortfall_description || minimum.name} — ${track.period_start} to ${track.period_end} (Required: $${track.amount_required.toFixed(2)}, Spent: $${track.amount_spent.toFixed(2)})`;

    try {
      const { data: invoice, error } = await adminClient
        .from("invoices")
        .insert({
          club_id: clubId,
          member_id: track.member_id,
          amount: track.shortfall,
          description: desc,
          due_date: track.period_end,
          status: "sent",
        })
        .select("id")
        .single();

      if (error) {
        result.errors.push(`Failed shortfall invoice for ${nameMap.get(track.member_id) || track.member_id}: ${error.message}`);
      } else {
        // Mark as invoiced
        await adminClient
          .from("spending_tracking")
          .update({ shortfall_invoiced: true, invoice_id: invoice.id })
          .eq("member_id", track.member_id)
          .eq("minimum_id", track.minimum_id)
          .eq("period_start", track.period_start);

        result.invoicesCreated++;
        result.totalAmount += track.shortfall;
      }
    } catch (err) {
      result.errors.push(`Error: ${err instanceof Error ? err.message : "Unknown"}`);
    }
  }

  return result;
}

/** Generate invoices for an assessment */
export async function runAssessmentCycle(
  adminClient: SupabaseClient,
  clubId: string,
  assessmentId: string,
  runBy: string
): Promise<BillingCycleResult> {
  const result: BillingCycleResult = { invoicesCreated: 0, totalAmount: 0, errors: [] };

  // Get the assessment
  const { data: assessment } = await adminClient
    .from("assessments")
    .select("*")
    .eq("id", assessmentId)
    .eq("club_id", clubId)
    .single();

  if (!assessment) {
    result.errors.push("Assessment not found");
    return result;
  }

  if (assessment.invoices_generated) {
    result.errors.push("Invoices already generated for this assessment");
    return result;
  }

  // Determine target members
  let memberIds: string[] = [];

  if (assessment.target_member_ids && assessment.target_member_ids.length > 0) {
    memberIds = assessment.target_member_ids;
  } else if (assessment.target_all_members) {
    const { data: allMembers } = await adminClient
      .from("members")
      .select("id")
      .eq("club_id", clubId)
      .eq("status", "active");
    memberIds = allMembers?.map((m) => m.id) ?? [];
  } else if (assessment.target_tier_ids && assessment.target_tier_ids.length > 0) {
    const { data: tierMembers } = await adminClient
      .from("members")
      .select("id")
      .eq("club_id", clubId)
      .eq("status", "active")
      .in("membership_tier_id", assessment.target_tier_ids);
    memberIds = tierMembers?.map((m) => m.id) ?? [];
  }

  if (memberIds.length === 0) {
    result.errors.push("No target members found for this assessment");
    return result;
  }

  const perMemberAmount = assessment.allow_installments && assessment.installment_count > 1
    ? Number(assessment.installment_amount) || Number(assessment.amount) / assessment.installment_count
    : Number(assessment.amount);

  for (const memberId of memberIds) {
    try {
      // Create assessment_member record
      await adminClient.from("assessment_members").upsert(
        {
          assessment_id: assessmentId,
          member_id: memberId,
          amount: Number(assessment.amount),
          status: "invoiced",
        },
        { onConflict: "assessment_id,member_id" }
      );

      if (assessment.allow_installments && assessment.installment_count > 1) {
        // Create installment invoices
        const baseDate = new Date(assessment.due_date);
        for (let i = 0; i < assessment.installment_count; i++) {
          const dueDate = new Date(baseDate);
          dueDate.setMonth(dueDate.getMonth() + i);
          const dueDateStr = dueDate.toISOString().split("T")[0];

          const desc = `${assessment.name} — Installment ${i + 1} of ${assessment.installment_count}`;

          const { error } = await adminClient.from("invoices").insert({
            club_id: clubId,
            member_id: memberId,
            amount: perMemberAmount,
            description: desc,
            due_date: dueDateStr,
            status: "sent",
          });

          if (error) {
            result.errors.push(`Installment ${i + 1} failed for ${memberId}: ${error.message}`);
          } else {
            result.invoicesCreated++;
            result.totalAmount += perMemberAmount;
          }
        }
      } else {
        // Single invoice
        const desc = assessment.description
          ? `${assessment.name} — ${assessment.description}`
          : assessment.name;

        const { error } = await adminClient.from("invoices").insert({
          club_id: clubId,
          member_id: memberId,
          amount: Number(assessment.amount),
          description: desc,
          due_date: assessment.due_date,
          status: "sent",
        });

        if (error) {
          result.errors.push(`Invoice failed for ${memberId}: ${error.message}`);
        } else {
          result.invoicesCreated++;
          result.totalAmount += Number(assessment.amount);
        }
      }
    } catch (err) {
      result.errors.push(`Error for ${memberId}: ${err instanceof Error ? err.message : "Unknown"}`);
    }
  }

  // Update assessment status
  await adminClient
    .from("assessments")
    .update({
      invoices_generated: true,
      status: "active",
      total_assessed: result.totalAmount,
    })
    .eq("id", assessmentId);

  return result;
}

/** Main billing cycle runner — records the cycle and dispatches to the correct handler */
export async function runBillingCycle(
  adminClient: SupabaseClient,
  clubId: string,
  type: BillingCycleType,
  periodStart: string,
  periodEnd: string,
  runBy: string,
  assessmentId?: string
): Promise<{ cycleId: string; result: BillingCycleResult }> {
  // Create billing cycle record
  const { data: cycle, error: cycleError } = await adminClient
    .from("billing_cycles")
    .insert({
      club_id: clubId,
      period_start: periodStart,
      period_end: periodEnd,
      type,
      status: "running",
      run_by: runBy,
    })
    .select("id")
    .single();

  if (cycleError || !cycle) {
    throw new Error(`Failed to create billing cycle: ${cycleError?.message}`);
  }

  let result: BillingCycleResult;

  try {
    switch (type) {
      case "dues":
        result = await runDuesCycle(adminClient, clubId, periodStart, periodEnd, runBy);
        break;
      case "minimum_shortfall":
        result = await runShortfallCycle(adminClient, clubId, periodStart, periodEnd, runBy);
        break;
      case "assessment":
        if (!assessmentId) throw new Error("assessment_id required for assessment cycle");
        result = await runAssessmentCycle(adminClient, clubId, assessmentId, runBy);
        break;
      default:
        throw new Error(`Unknown billing cycle type: ${type}`);
    }

    // Update cycle
    await adminClient
      .from("billing_cycles")
      .update({
        status: result.errors.length > 0 && result.invoicesCreated === 0 ? "failed" : "completed",
        invoices_created: result.invoicesCreated,
        total_amount: result.totalAmount,
        error_message: result.errors.length > 0 ? result.errors.join("\n") : null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", cycle.id);

    return { cycleId: cycle.id, result };
  } catch (err) {
    await adminClient
      .from("billing_cycles")
      .update({
        status: "failed",
        error_message: err instanceof Error ? err.message : "Unknown error",
        completed_at: new Date().toISOString(),
      })
      .eq("id", cycle.id);

    throw err;
  }
}

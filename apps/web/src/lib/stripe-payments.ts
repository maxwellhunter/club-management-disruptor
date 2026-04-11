/**
 * Stripe Payment Methods & ACH Auto-Draft Engine
 *
 * Handles:
 * - Adding bank accounts (ACH) and cards to members via Stripe SetupIntents
 * - Listing/removing payment methods
 * - Running auto-draft batches (creating PaymentIntents for each member's balance)
 * - Tracking draft results
 */

import Stripe from "stripe";
import { getStripe } from "./stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Setup Intents (for adding payment methods) ────────────────────

/**
 * Create a Stripe SetupIntent for a member to add a payment method.
 * The frontend uses this to collect bank account or card details.
 */
export async function createSetupIntent(
  stripeCustomerId: string,
  paymentMethodTypes: ("us_bank_account" | "card")[] = ["us_bank_account"]
): Promise<Stripe.SetupIntent> {
  return getStripe().setupIntents.create({
    customer: stripeCustomerId,
    payment_method_types: paymentMethodTypes,
    // For ACH, mandate_data is required for recurring debits
    ...(paymentMethodTypes.includes("us_bank_account") && {
      payment_method_options: {
        us_bank_account: {
          financial_connections: {
            permissions: ["payment_method"],
          },
          verification_method: "automatic",
        },
      },
      mandate_data: {
        customer_acceptance: {
          type: "online",
          online: {
            ip_address: "0.0.0.0", // Will be overridden by Stripe.js
            user_agent: "ClubOS",
          },
        },
      },
    }),
  });
}

/**
 * After SetupIntent succeeds, save the payment method to our DB.
 */
export async function savePaymentMethod(
  adminClient: SupabaseClient,
  clubId: string,
  memberId: string,
  setupIntentId: string,
  setAsDefault: boolean = true
): Promise<{ id: string; label: string }> {
  const stripe = getStripe();
  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId, {
    expand: ["payment_method", "mandate"],
  });

  if (setupIntent.status !== "succeeded") {
    throw new Error(`SetupIntent is ${setupIntent.status}, not succeeded`);
  }

  const pm = setupIntent.payment_method as Stripe.PaymentMethod;
  if (!pm) throw new Error("No payment method on SetupIntent");

  let label: string;
  let lastFour: string | null = null;
  let bankName: string | null = null;
  let cardBrand: string | null = null;
  let type: "us_bank_account" | "card";

  if (pm.us_bank_account) {
    type = "us_bank_account";
    lastFour = pm.us_bank_account.last4 ?? null;
    bankName = pm.us_bank_account.bank_name ?? null;
    label = `${bankName ?? "Bank"} ••••${lastFour ?? ""}`;
  } else if (pm.card) {
    type = "card";
    lastFour = pm.card.last4 ?? null;
    cardBrand = pm.card.brand ?? null;
    label = `${(cardBrand ?? "Card").charAt(0).toUpperCase() + (cardBrand ?? "card").slice(1)} ••••${lastFour ?? ""}`;
  } else {
    throw new Error(`Unsupported payment method type: ${pm.type}`);
  }

  const mandateId = setupIntent.mandate
    ? typeof setupIntent.mandate === "string"
      ? setupIntent.mandate
      : setupIntent.mandate.id
    : null;

  // If setting as default, clear existing defaults first
  if (setAsDefault) {
    await adminClient
      .from("payment_methods")
      .update({ is_default: false })
      .eq("member_id", memberId)
      .eq("is_default", true);
  }

  const { data: saved, error } = await adminClient
    .from("payment_methods")
    .insert({
      club_id: clubId,
      member_id: memberId,
      stripe_payment_method_id: pm.id,
      type,
      label,
      last_four: lastFour,
      bank_name: bankName,
      card_brand: cardBrand,
      is_default: setAsDefault,
      status: "active",
      stripe_mandate_id: mandateId,
      mandate_status: mandateId ? "active" : null,
    })
    .select("id, label")
    .single();

  if (error) throw new Error(`Failed to save payment method: ${error.message}`);
  return saved;
}

/**
 * List a member's active payment methods.
 */
export async function listPaymentMethods(
  supabase: SupabaseClient,
  memberId: string
) {
  const { data, error } = await supabase
    .from("payment_methods")
    .select("*")
    .eq("member_id", memberId)
    .eq("status", "active")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to list payment methods: ${error.message}`);
  return data ?? [];
}

/**
 * Remove a payment method (detach from Stripe + mark inactive).
 */
export async function removePaymentMethod(
  adminClient: SupabaseClient,
  memberId: string,
  paymentMethodId: string
) {
  const { data: pm } = await adminClient
    .from("payment_methods")
    .select("stripe_payment_method_id")
    .eq("id", paymentMethodId)
    .eq("member_id", memberId)
    .single();

  if (!pm) throw new Error("Payment method not found");

  // Detach from Stripe
  try {
    await getStripe().paymentMethods.detach(pm.stripe_payment_method_id);
  } catch {
    // If already detached in Stripe, continue
  }

  // Mark as detached in our DB
  await adminClient
    .from("payment_methods")
    .update({ status: "detached" })
    .eq("id", paymentMethodId);
}

// ─── Auto-Draft Engine ────────────────────────────────────────────

export interface AutodraftOptions {
  clubId: string;
  period: string; // YYYY-MM
  runBy: string;
  dryRun?: boolean; // preview mode — don't charge
}

export interface AutodraftResult {
  runId: string;
  attempted: number;
  succeeded: number;
  failed: number;
  skipped: number;
  totalCollected: number;
  totalFailed: number;
  errors: string[];
  items: {
    memberId: string;
    memberName: string;
    amount: number;
    status: string;
    reason?: string;
  }[];
}

/**
 * Run the auto-draft batch for a billing period.
 *
 * Process:
 * 1. Find all member_statements for the period with total_due > 0
 * 2. For each, find their default payment method
 * 3. Create a Stripe PaymentIntent
 * 4. Record the result
 */
export async function runAutodraft(
  adminClient: SupabaseClient,
  options: AutodraftOptions
): Promise<AutodraftResult> {
  const { clubId, period, runBy, dryRun = false } = options;
  const stripe = getStripe();

  const result: AutodraftResult = {
    runId: "",
    attempted: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    totalCollected: 0,
    totalFailed: 0,
    errors: [],
    items: [],
  };

  // Create run record
  const { data: run, error: runError } = await adminClient
    .from("autodraft_runs")
    .insert({
      club_id: clubId,
      period,
      status: "processing",
      run_by: runBy,
    })
    .select("id")
    .single();

  if (runError || !run) {
    throw new Error(`Failed to create autodraft run: ${runError?.message}`);
  }
  result.runId = run.id;

  try {
    // Get member statements with balance > 0
    const { data: statements } = await adminClient
      .from("member_statements")
      .select(`
        id, member_id, total_due,
        members:member_id (
          first_name, last_name, email, stripe_customer_id
        )
      `)
      .eq("club_id", clubId)
      .eq("period", period)
      .gt("total_due", 0);

    if (!statements || statements.length === 0) {
      result.errors.push("No statements with outstanding balances");
      await finalizeAutodraftRun(adminClient, run.id, result);
      return result;
    }

    // Get all active default payment methods for these members
    const memberIds = statements.map((s) => s.member_id);
    const { data: paymentMethods } = await adminClient
      .from("payment_methods")
      .select("*")
      .in("member_id", memberIds)
      .eq("status", "active")
      .eq("is_default", true);

    const pmByMember = new Map(
      (paymentMethods ?? []).map((pm) => [pm.member_id, pm])
    );

    // Process each statement
    for (const stmt of statements) {
      const member = stmt.members as unknown as {
        first_name: string;
        last_name: string;
        email: string;
        stripe_customer_id: string | null;
      };
      const memberName = `${member?.first_name ?? ""} ${member?.last_name ?? ""}`.trim();
      const amount = Number(stmt.total_due);
      const amountCents = Math.round(amount * 100);

      result.attempted++;

      // Check for payment method
      const pm = pmByMember.get(stmt.member_id);
      if (!pm) {
        result.skipped++;
        result.items.push({
          memberId: stmt.member_id,
          memberName,
          amount,
          status: "skipped",
          reason: "No payment method on file",
        });

        await adminClient.from("autodraft_items").insert({
          run_id: run.id,
          club_id: clubId,
          member_id: stmt.member_id,
          statement_id: stmt.id,
          amount,
          status: "skipped",
          failure_reason: "No payment method on file",
        });
        continue;
      }

      // Check for Stripe customer
      if (!member?.stripe_customer_id) {
        result.skipped++;
        result.items.push({
          memberId: stmt.member_id,
          memberName,
          amount,
          status: "skipped",
          reason: "No Stripe customer",
        });

        await adminClient.from("autodraft_items").insert({
          run_id: run.id,
          club_id: clubId,
          member_id: stmt.member_id,
          statement_id: stmt.id,
          payment_method_id: pm.id,
          amount,
          status: "skipped",
          failure_reason: "No Stripe customer ID",
        });
        continue;
      }

      if (dryRun) {
        result.succeeded++;
        result.totalCollected += amount;
        result.items.push({
          memberId: stmt.member_id,
          memberName,
          amount,
          status: "dry_run",
        });
        continue;
      }

      // Create PaymentIntent
      try {
        const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
          amount: amountCents,
          currency: "usd",
          customer: member.stripe_customer_id,
          payment_method: pm.stripe_payment_method_id,
          off_session: true,
          confirm: true,
          description: `Monthly statement — ${period}`,
          metadata: {
            club_id: clubId,
            member_id: stmt.member_id,
            period,
            statement_id: stmt.id,
            autodraft_run_id: run.id,
          },
        };

        // For ACH, attach mandate
        if (pm.type === "us_bank_account" && pm.stripe_mandate_id) {
          paymentIntentParams.mandate = pm.stripe_mandate_id;
          paymentIntentParams.payment_method_types = ["us_bank_account"];
        }

        const pi = await stripe.paymentIntents.create(paymentIntentParams);

        const succeeded = pi.status === "succeeded";
        const processing = pi.status === "processing"; // ACH takes days

        if (succeeded || processing) {
          result.succeeded++;
          result.totalCollected += amount;
          result.items.push({
            memberId: stmt.member_id,
            memberName,
            amount,
            status: processing ? "processing" : "succeeded",
          });
        } else if (pi.status === "requires_action") {
          result.failed++;
          result.totalFailed += amount;
          result.items.push({
            memberId: stmt.member_id,
            memberName,
            amount,
            status: "requires_action",
            reason: "Requires additional authentication",
          });
        } else {
          result.failed++;
          result.totalFailed += amount;
          result.items.push({
            memberId: stmt.member_id,
            memberName,
            amount,
            status: "failed",
            reason: `Unexpected status: ${pi.status}`,
          });
        }

        // Record the draft item
        await adminClient.from("autodraft_items").insert({
          run_id: run.id,
          club_id: clubId,
          member_id: stmt.member_id,
          statement_id: stmt.id,
          payment_method_id: pm.id,
          stripe_payment_intent_id: pi.id,
          amount,
          status: succeeded ? "succeeded" : processing ? "processing" : pi.status === "requires_action" ? "requires_action" : "failed",
          failure_reason: !succeeded && !processing ? `Status: ${pi.status}` : null,
          completed_at: succeeded ? new Date().toISOString() : null,
        });

        // If payment succeeded immediately (card), mark invoices paid
        if (succeeded) {
          await markStatementPaid(adminClient, clubId, stmt, pi.id);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        result.failed++;
        result.totalFailed += amount;
        result.errors.push(`${memberName}: ${msg}`);
        result.items.push({
          memberId: stmt.member_id,
          memberName,
          amount,
          status: "failed",
          reason: msg,
        });

        await adminClient.from("autodraft_items").insert({
          run_id: run.id,
          club_id: clubId,
          member_id: stmt.member_id,
          statement_id: stmt.id,
          payment_method_id: pm.id,
          amount,
          status: "failed",
          failure_reason: msg,
        });
      }
    }

    await finalizeAutodraftRun(adminClient, run.id, result);
    return result;
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : "Unknown error");
    await finalizeAutodraftRun(adminClient, run.id, result, true);
    throw err;
  }
}

// ─── Helpers ───────────────────────────────────────────

async function finalizeAutodraftRun(
  adminClient: SupabaseClient,
  runId: string,
  result: AutodraftResult,
  isFailed = false
) {
  let status: string;
  if (isFailed) status = "failed";
  else if (result.failed > 0 && result.succeeded > 0) status = "partial";
  else if (result.failed > 0) status = "failed";
  else status = "completed";

  await adminClient
    .from("autodraft_runs")
    .update({
      status,
      members_attempted: result.attempted,
      members_succeeded: result.succeeded,
      members_failed: result.failed,
      members_skipped: result.skipped,
      total_collected: Math.round(result.totalCollected * 100) / 100,
      total_failed: Math.round(result.totalFailed * 100) / 100,
      error_message: result.errors.length > 0 ? result.errors.join("\n") : null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

/**
 * When a payment succeeds, mark all invoices in the statement as paid
 * and create a payment record.
 */
async function markStatementPaid(
  adminClient: SupabaseClient,
  clubId: string,
  stmt: { member_id: string; total_due: number; id: string },
  stripePaymentIntentId: string
) {
  // Create payment record
  await adminClient.from("payments").insert({
    club_id: clubId,
    member_id: stmt.member_id,
    stripe_payment_id: stripePaymentIntentId,
    amount: Number(stmt.total_due),
    method: "ach",
    description: `Auto-draft payment — statement ${stmt.id.slice(0, 8)}`,
  });

  // Note: individual invoice marking happens via Stripe webhooks (invoice.paid)
  // For direct PaymentIntents (not Stripe invoices), we'd need to mark our invoices manually.
  // The webhook handler for payment_intent.succeeded will handle this via metadata.
}

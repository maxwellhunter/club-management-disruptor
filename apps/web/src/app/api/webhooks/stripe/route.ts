import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// Disable Next.js body parsing — we need the raw body for signature verification
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "Missing signature or webhook secret" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json(
      { error: `Webhook Error: ${message}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionChange(
          event.data.object as Stripe.Subscription
        );
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
        break;

      case "invoice.created":
        await handleInvoiceCreated(event.data.object as Stripe.Invoice);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(
          event.data.object as Stripe.Invoice
        );
        break;

      // ACH auto-draft events
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent
        );
        break;

      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent
        );
        break;

      case "payment_intent.processing":
        // ACH is processing — update status but don't mark paid yet
        await handlePaymentIntentProcessing(
          event.data.object as Stripe.PaymentIntent
        );
        break;

      default:
        // Unhandled event type — acknowledge it
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}

// ─── Helpers to resolve Stripe objects to our member records ────────────

async function getMemberByStripeCustomer(customerId: string) {
  const { data } = await getSupabaseAdmin()
    .from("members")
    .select("id, club_id")
    .eq("stripe_customer_id", customerId)
    .single();
  return data;
}

async function getMemberByMetadata(metadata: Stripe.Metadata | null) {
  if (!metadata?.member_id) return null;
  const { data } = await getSupabaseAdmin()
    .from("members")
    .select("id, club_id, stripe_customer_id")
    .eq("id", metadata.member_id)
    .single();
  return data;
}

// ─── Event Handlers ────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription") return;

  const member = await getMemberByMetadata(session.metadata);
  if (!member) {
    console.error("Checkout completed but no member found:", session.metadata);
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (subscriptionId) {
    await getSupabaseAdmin()
      .from("members")
      .update({
        stripe_subscription_id: subscriptionId,
        subscription_status: "active",
      })
      .eq("id", member.id);
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const member = await getMemberByStripeCustomer(customerId);
  if (!member) {
    console.error(
      "Subscription change but no member found for customer:",
      customerId
    );
    return;
  }

  await getSupabaseAdmin()
    .from("members")
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
    })
    .eq("id", member.id);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;

  const member = await getMemberByStripeCustomer(customerId);
  if (!member) return;

  await getSupabaseAdmin()
    .from("members")
    .update({
      subscription_status: "canceled",
    })
    .eq("id", member.id);
}

async function handleInvoiceCreated(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  if (!customerId) return;

  const member = await getMemberByStripeCustomer(customerId);
  if (!member) return;

  const amount = (invoice.amount_due ?? 0) / 100;
  const dueDate = invoice.due_date
    ? new Date(invoice.due_date * 1000).toISOString()
    : new Date().toISOString();

  // Upsert — avoid duplicates if webhook fires twice
  await getSupabaseAdmin().from("invoices").upsert(
    {
      club_id: member.club_id,
      member_id: member.id,
      stripe_invoice_id: invoice.id,
      amount,
      status: "sent",
      description:
        invoice.description || `Membership dues – ${invoice.number || ""}`,
      due_date: dueDate,
    },
    { onConflict: "stripe_invoice_id", ignoreDuplicates: false }
  );
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer?.id;

  if (!customerId) return;

  const member = await getMemberByStripeCustomer(customerId);
  if (!member) return;

  // Update invoice status
  if (invoice.id) {
    await getSupabaseAdmin()
      .from("invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("stripe_invoice_id", invoice.id);
  }

  // Insert payment record
  const amount = (invoice.amount_paid ?? 0) / 100;
  await getSupabaseAdmin().from("payments").insert({
    club_id: member.club_id,
    member_id: member.id,
    invoice_id: null, // We could look up the invoice row, but keeping it simple
    stripe_payment_id: invoice.payment_intent
      ? typeof invoice.payment_intent === "string"
        ? invoice.payment_intent
        : invoice.payment_intent.id
      : null,
    amount,
    method: "card",
    description: `Payment for invoice ${invoice.number || invoice.id}`,
  });
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  if (!invoice.id) return;

  await getSupabaseAdmin()
    .from("invoices")
    .update({ status: "overdue" })
    .eq("stripe_invoice_id", invoice.id);
}

// ─── ACH Auto-Draft Event Handlers ───────────────────────────────

/**
 * PaymentIntent succeeded — ACH cleared or card charged.
 * If it's from auto-draft (has metadata.autodraft_run_id), update records.
 */
async function handlePaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
  const meta = pi.metadata;
  if (!meta?.autodraft_run_id) return; // Not from auto-draft

  const admin = getSupabaseAdmin();

  // Update the autodraft_item
  await admin
    .from("autodraft_items")
    .update({
      status: "succeeded",
      completed_at: new Date().toISOString(),
    })
    .eq("stripe_payment_intent_id", pi.id);

  // Create payment record
  const member = await getMemberByStripeCustomer(
    typeof pi.customer === "string" ? pi.customer : pi.customer?.id ?? ""
  );
  if (!member) return;

  const amount = pi.amount / 100;
  const method = pi.payment_method_types?.includes("us_bank_account") ? "ach" : "card";

  await admin.from("payments").insert({
    club_id: member.club_id,
    member_id: member.id,
    stripe_payment_id: pi.id,
    amount,
    method,
    description: pi.description || `Auto-draft payment — ${meta.period ?? ""}`,
  });

  // Mark statement invoices as paid
  if (meta.statement_id) {
    const { data: stmt } = await admin
      .from("member_statements")
      .select("invoice_ids")
      .eq("id", meta.statement_id)
      .single();

    if (stmt?.invoice_ids?.length) {
      await admin
        .from("invoices")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .in("id", stmt.invoice_ids)
        .in("status", ["sent", "overdue"]);
    }
  }

  // Recount successful drafts on the run
  await updateAutodraftRunCounts(admin, meta.autodraft_run_id);
}

/**
 * PaymentIntent failed — ACH bounced or card declined.
 */
async function handlePaymentIntentFailed(pi: Stripe.PaymentIntent) {
  const meta = pi.metadata;
  if (!meta?.autodraft_run_id) return;

  const admin = getSupabaseAdmin();
  const failureMessage =
    pi.last_payment_error?.message ?? "Payment failed";

  await admin
    .from("autodraft_items")
    .update({
      status: "failed",
      failure_reason: failureMessage,
      completed_at: new Date().toISOString(),
    })
    .eq("stripe_payment_intent_id", pi.id);

  await updateAutodraftRunCounts(admin, meta.autodraft_run_id);
}

/**
 * PaymentIntent processing — ACH debit initiated, waiting for bank.
 */
async function handlePaymentIntentProcessing(pi: Stripe.PaymentIntent) {
  const meta = pi.metadata;
  if (!meta?.autodraft_run_id) return;

  await getSupabaseAdmin()
    .from("autodraft_items")
    .update({ status: "processing" })
    .eq("stripe_payment_intent_id", pi.id);
}

/**
 * Recount autodraft run totals from items after async updates.
 */
async function updateAutodraftRunCounts(
  admin: ReturnType<typeof getSupabaseAdmin>,
  runId: string
) {
  const { data: items } = await admin
    .from("autodraft_items")
    .select("status, amount")
    .eq("run_id", runId);

  if (!items) return;

  let succeeded = 0,
    failed = 0,
    skipped = 0,
    totalCollected = 0,
    totalFailed = 0;

  for (const item of items) {
    if (item.status === "succeeded") { succeeded++; totalCollected += Number(item.amount); }
    else if (item.status === "failed") { failed++; totalFailed += Number(item.amount); }
    else if (item.status === "skipped") { skipped++; }
  }

  let status: string;
  if (failed > 0 && succeeded > 0) status = "partial";
  else if (failed > 0) status = "failed";
  else status = "completed";

  await admin
    .from("autodraft_runs")
    .update({
      status,
      members_succeeded: succeeded,
      members_failed: failed,
      members_skipped: skipped,
      total_collected: Math.round(totalCollected * 100) / 100,
      total_failed: Math.round(totalFailed * 100) / 100,
    })
    .eq("id", runId);
}

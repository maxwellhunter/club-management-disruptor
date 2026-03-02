import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

// Service role client — webhooks come from Stripe, not authenticated users
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
  const { data } = await supabaseAdmin
    .from("members")
    .select("id, club_id")
    .eq("stripe_customer_id", customerId)
    .single();
  return data;
}

async function getMemberByMetadata(metadata: Stripe.Metadata | null) {
  if (!metadata?.member_id) return null;
  const { data } = await supabaseAdmin
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
    await supabaseAdmin
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

  await supabaseAdmin
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

  await supabaseAdmin
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
  await supabaseAdmin.from("invoices").upsert(
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
    await supabaseAdmin
      .from("invoices")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
      })
      .eq("stripe_invoice_id", invoice.id);
  }

  // Insert payment record
  const amount = (invoice.amount_paid ?? 0) / 100;
  await supabaseAdmin.from("payments").insert({
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

  await supabaseAdmin
    .from("invoices")
    .update({ status: "overdue" })
    .eq("stripe_invoice_id", invoice.id);
}

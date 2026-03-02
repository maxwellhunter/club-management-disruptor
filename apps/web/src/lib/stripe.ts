import Stripe from "stripe";

// Lazy-initialized Stripe instance (avoids crash at build time when env vars are missing)
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is not configured");
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      typescript: true,
    });
  }
  return _stripe;
}

/**
 * Create a Stripe Customer for a club member.
 * Stores member_id and club_id in metadata for webhook resolution.
 */
export async function createStripeCustomer(params: {
  email: string;
  name: string;
  memberId: string;
  clubId: string;
}): Promise<Stripe.Customer> {
  return getStripe().customers.create({
    email: params.email,
    name: params.name,
    metadata: {
      member_id: params.memberId,
      club_id: params.clubId,
    },
  });
}

/**
 * Create a Stripe Checkout Session for subscribing to a membership tier.
 * Redirects user to Stripe-hosted checkout page.
 */
export async function createSubscriptionCheckout(params: {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  memberId: string;
}): Promise<Stripe.Checkout.Session> {
  return getStripe().checkout.sessions.create({
    customer: params.customerId,
    mode: "subscription",
    line_items: [{ price: params.priceId, quantity: 1 }],
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      member_id: params.memberId,
    },
  });
}

/**
 * Create a Stripe Customer Portal session.
 * Members use this to manage payment methods, view invoices, cancel subscriptions.
 */
export async function createPortalSession(params: {
  customerId: string;
  returnUrl: string;
}): Promise<Stripe.BillingPortal.Session> {
  return getStripe().billingPortal.sessions.create({
    customer: params.customerId,
    return_url: params.returnUrl,
  });
}

/**
 * Retrieve a Stripe Subscription by ID.
 */
export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  return getStripe().subscriptions.retrieve(subscriptionId);
}

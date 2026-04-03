import type { POSProviderAdapter, CreateSaleParams, SaleResult, RefundParams, RefundResult } from "./types";
import { getStripe } from "../stripe";

/**
 * Stripe Terminal POS provider.
 *
 * Uses Stripe Payment Intents for card-present transactions.
 * Config expects: { location_id?: string } — Stripe Terminal Location ID.
 *
 * For "member_charge" payments, we skip Stripe and just record the charge
 * to the member's club account (creates an invoice instead).
 */
export class StripeTerminalProvider implements POSProviderAdapter {
  readonly provider = "stripe_terminal" as const;
  private locationId: string | null;

  constructor(config: Record<string, unknown>) {
    this.locationId = (config.location_id as string) ?? null;
  }

  async validateConfig(config: Record<string, unknown>): Promise<{ valid: boolean; error?: string }> {
    try {
      const stripe = getStripe();
      // Verify the Stripe key works
      await stripe.balance.retrieve();

      // If a location_id is provided, verify it exists
      if (config.location_id) {
        await stripe.terminal.locations.retrieve(config.location_id as string);
      }

      return { valid: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid Stripe configuration";
      return { valid: false, error: message };
    }
  }

  async createSale(params: CreateSaleParams): Promise<SaleResult> {
    // For member charges (post to account), we don't use Stripe — the API layer
    // will create an invoice instead. Return success with no external ID.
    if (params.paymentMethod === "member_charge") {
      return { success: true };
    }

    try {
      const stripe = getStripe();

      const paymentIntent = await stripe.paymentIntents.create({
        amount: params.amount,
        currency: params.currency ?? "usd",
        payment_method_types: ["card_present"],
        capture_method: "automatic",
        description: params.description ?? "POS Sale",
        metadata: {
          pos_sale: "true",
          location: params.location,
          member_id: params.memberId ?? "",
          item_count: params.items.length.toString(),
        },
      });

      return {
        success: true,
        externalId: paymentIntent.id,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Payment failed";
      return { success: false, error: message };
    }
  }

  async refundSale(params: RefundParams): Promise<RefundResult> {
    try {
      const stripe = getStripe();

      const refund = await stripe.refunds.create({
        payment_intent: params.externalId,
        amount: params.amount, // undefined = full refund
        reason: "requested_by_customer",
        metadata: {
          pos_refund: "true",
          reason: params.reason ?? "",
        },
      });

      return {
        success: true,
        refundExternalId: refund.id,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Refund failed";
      return { success: false, error: message };
    }
  }

  async voidSale(externalId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const stripe = getStripe();
      await stripe.paymentIntents.cancel(externalId);
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Void failed";
      return { success: false, error: message };
    }
  }
}

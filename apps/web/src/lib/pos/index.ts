import type { POSProvider } from "@club/shared";
import type { POSProviderAdapter } from "./types";
import { StripeTerminalProvider } from "./stripe-terminal";
import { ManualProvider } from "./manual";

export type { POSProviderAdapter } from "./types";
export type { CreateSaleParams, SaleResult, RefundParams, RefundResult } from "./types";

/**
 * Factory: get the right POS provider adapter for a given provider type.
 * Provider config is passed through so the adapter can use credentials/settings.
 */
export function getPOSProvider(
  provider: POSProvider,
  config: Record<string, unknown> = {}
): POSProviderAdapter {
  switch (provider) {
    case "stripe_terminal":
      return new StripeTerminalProvider(config);
    case "manual":
      return new ManualProvider();
    case "square":
    case "toast":
    case "lightspeed":
      throw new Error(
        `${provider} integration is not yet available. Please use Stripe Terminal or Manual mode.`
      );
    default:
      throw new Error(`Unknown POS provider: ${provider}`);
  }
}

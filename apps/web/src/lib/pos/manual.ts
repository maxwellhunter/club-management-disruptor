import type { POSProviderAdapter, CreateSaleParams, SaleResult, RefundParams, RefundResult } from "./types";

/**
 * Manual POS provider — no external payment system.
 * Records transactions in ClubOS only (cash, check, or member charge).
 * Always succeeds; no external IDs.
 */
export class ManualProvider implements POSProviderAdapter {
  readonly provider = "manual" as const;

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    return { valid: true };
  }

  async createSale(_params: CreateSaleParams): Promise<SaleResult> {
    return { success: true };
  }

  async refundSale(_params: RefundParams): Promise<RefundResult> {
    return { success: true };
  }

  async voidSale(_externalId: string): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }
}

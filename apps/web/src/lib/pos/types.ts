import type { POSProvider, POSLocation } from "@club/shared";

/**
 * Provider-agnostic POS interface.
 * Each POS provider (Stripe Terminal, Square, Toast, Lightspeed)
 * implements this interface so the rest of the app doesn't care
 * which provider is active.
 */
export interface POSProviderAdapter {
  readonly provider: POSProvider;

  /** Validate that the provider config/credentials are usable. */
  validateConfig(config: Record<string, unknown>): Promise<{ valid: boolean; error?: string }>;

  /** Process a sale and return a provider-specific external ID. */
  createSale(params: CreateSaleParams): Promise<SaleResult>;

  /** Refund a previous transaction (full or partial). */
  refundSale(params: RefundParams): Promise<RefundResult>;

  /** Void an uncommitted transaction. */
  voidSale(externalId: string): Promise<{ success: boolean; error?: string }>;

  /** Sync recent transactions from the external provider (for reconciliation). */
  syncTransactions?(since: Date): Promise<SyncedTransaction[]>;
}

export interface CreateSaleParams {
  amount: number; // total in cents
  currency?: string;
  description?: string;
  memberId?: string | null;
  memberEmail?: string | null;
  items: SaleItem[];
  paymentMethod?: string; // "card", "cash", "member_charge"
  location: POSLocation;
  metadata?: Record<string, unknown>;
}

export interface SaleItem {
  name: string;
  sku?: string | null;
  quantity: number;
  unitPrice: number; // in cents
  category?: string | null;
}

export interface SaleResult {
  success: boolean;
  externalId?: string;
  receiptUrl?: string;
  error?: string;
}

export interface RefundParams {
  externalId: string;
  amount?: number; // partial refund amount in cents; omit for full refund
  reason?: string;
}

export interface RefundResult {
  success: boolean;
  refundExternalId?: string;
  error?: string;
}

export interface SyncedTransaction {
  externalId: string;
  amount: number;
  status: "completed" | "refunded" | "voided";
  createdAt: Date;
  items: SaleItem[];
  metadata?: Record<string, unknown>;
}

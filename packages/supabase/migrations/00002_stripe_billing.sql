-- ============================================
-- Migration: Add Stripe billing columns
-- ============================================

-- Add Stripe fields to members
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT NULL
    CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'unpaid', 'trialing', 'incomplete', NULL));

CREATE UNIQUE INDEX IF NOT EXISTS idx_members_stripe_customer
  ON members(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_members_subscription_status
  ON members(club_id, subscription_status);

-- Add Stripe price linkage to membership tiers
ALTER TABLE membership_tiers
  ADD COLUMN IF NOT EXISTS stripe_product_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

-- Add unique index on stripe_invoice_id for webhook idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_stripe_invoice
  ON invoices(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;

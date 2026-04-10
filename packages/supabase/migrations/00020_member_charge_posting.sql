-- ============================================
-- 00020: Member Charge Posting
-- Adds billing_period column to pos_transactions
-- for monthly charge consolidation into invoices.
-- ============================================

-- Add billing_period column (format: YYYY-MM)
ALTER TABLE pos_transactions
ADD COLUMN billing_period TEXT;

-- Backfill existing member_charge transactions with billing_period
-- derived from their created_at timestamp
UPDATE pos_transactions
SET billing_period = to_char(created_at, 'YYYY-MM')
WHERE payment_method = 'member_charge'
  AND billing_period IS NULL;

-- Index for querying a member's charges in a given period
CREATE INDEX idx_pos_transactions_member_period
    ON pos_transactions(member_id, billing_period)
    WHERE payment_method = 'member_charge';

-- Index for querying all club charges in a given period
CREATE INDEX idx_pos_transactions_club_period
    ON pos_transactions(club_id, billing_period)
    WHERE payment_method = 'member_charge';

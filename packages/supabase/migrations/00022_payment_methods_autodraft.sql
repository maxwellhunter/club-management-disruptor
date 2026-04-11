-- ============================================
-- 00022: Payment Methods & Auto-Draft
-- Stores member payment methods (bank accounts, cards)
-- and tracks auto-draft batch runs.
-- ============================================

-- Payment methods on file (Stripe PaymentMethod references)
CREATE TABLE payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  stripe_payment_method_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK (type IN ('us_bank_account', 'card')),
  -- Display info (safe to store — not sensitive)
  label TEXT NOT NULL,              -- e.g. "Chase ••••4567" or "Visa ••••1234"
  last_four TEXT,                   -- last 4 digits
  bank_name TEXT,                   -- for ACH
  card_brand TEXT,                  -- for cards
  -- Status
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'requires_confirmation', 'failed', 'detached')),
  -- Stripe mandate (required for ACH recurring debits)
  stripe_mandate_id TEXT,
  mandate_status TEXT CHECK (mandate_status IN ('active', 'inactive', 'pending')),
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-draft batch runs
CREATE TABLE autodraft_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  period TEXT NOT NULL,                         -- YYYY-MM
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'partial')),
  members_attempted INT NOT NULL DEFAULT 0,
  members_succeeded INT NOT NULL DEFAULT 0,
  members_failed INT NOT NULL DEFAULT 0,
  members_skipped INT NOT NULL DEFAULT 0,      -- no payment method on file
  total_collected NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_failed NUMERIC(10,2) NOT NULL DEFAULT 0,
  error_message TEXT,
  run_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Individual draft attempts per member per run
CREATE TABLE autodraft_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES autodraft_runs(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  statement_id UUID REFERENCES member_statements(id),
  payment_method_id UUID REFERENCES payment_methods(id),
  stripe_payment_intent_id TEXT,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'skipped', 'requires_action')),
  failure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Club-level auto-draft settings
CREATE TABLE autodraft_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  draft_day_of_month INT NOT NULL DEFAULT 15 CHECK (draft_day_of_month BETWEEN 1 AND 28),
  grace_period_days INT NOT NULL DEFAULT 10,   -- days after statement before draft
  retry_failed BOOLEAN NOT NULL DEFAULT TRUE,
  max_retries INT NOT NULL DEFAULT 2,
  notify_members BOOLEAN NOT NULL DEFAULT TRUE, -- email before drafting
  advance_notice_days INT NOT NULL DEFAULT 3,   -- days notice before draft
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE autodraft_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE autodraft_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE autodraft_settings ENABLE ROW LEVEL SECURITY;

-- RLS: Members see own payment methods, admins see all
CREATE POLICY "Members view own payment methods"
  ON payment_methods FOR SELECT
  USING (member_id = auth.uid() OR is_club_admin());

CREATE POLICY "Members manage own payment methods"
  ON payment_methods FOR ALL
  USING (member_id = auth.uid() OR is_club_admin());

-- RLS: Admin-only for autodraft
CREATE POLICY "Admins manage autodraft runs"
  ON autodraft_runs FOR ALL
  USING (is_club_admin());

CREATE POLICY "Admins view autodraft items"
  ON autodraft_items FOR ALL
  USING (is_club_admin());

CREATE POLICY "Admins manage autodraft settings"
  ON autodraft_settings FOR ALL
  USING (is_club_admin());

-- Indexes
CREATE INDEX idx_payment_methods_member ON payment_methods(member_id) WHERE status = 'active';
CREATE INDEX idx_payment_methods_stripe ON payment_methods(stripe_payment_method_id);
CREATE INDEX idx_autodraft_runs_club_period ON autodraft_runs(club_id, period);
CREATE INDEX idx_autodraft_items_run ON autodraft_items(run_id);
CREATE INDEX idx_autodraft_items_member ON autodraft_items(member_id);

-- Updated_at triggers
CREATE TRIGGER set_payment_methods_updated_at BEFORE UPDATE ON payment_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_autodraft_settings_updated_at BEFORE UPDATE ON autodraft_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

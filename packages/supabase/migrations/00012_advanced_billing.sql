-- ============================================
-- Advanced Billing: Minimums, Assessments, Family Consolidation
-- ============================================

-- ============================================
-- SPENDING MINIMUMS (per tier, per period)
-- ============================================
CREATE TABLE spending_minimums (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  tier_id UUID NOT NULL REFERENCES membership_tiers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                -- "F&B Minimum", "Pro Shop Minimum"
  category TEXT NOT NULL,            -- "dining", "pro_shop", "bar", "total"
  amount NUMERIC(10,2) NOT NULL,     -- Minimum spend amount per period
  period TEXT NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly', 'quarterly', 'annually')),
  enforce_shortfall BOOLEAN NOT NULL DEFAULT TRUE,  -- Auto-invoice shortfall?
  shortfall_description TEXT DEFAULT 'Minimum spending shortfall',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Track actual spending against minimums
CREATE TABLE spending_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  minimum_id UUID NOT NULL REFERENCES spending_minimums(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount_spent NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount_required NUMERIC(10,2) NOT NULL,
  shortfall NUMERIC(10,2) NOT NULL DEFAULT 0,
  shortfall_invoiced BOOLEAN NOT NULL DEFAULT FALSE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(member_id, minimum_id, period_start)
);

-- ============================================
-- ASSESSMENTS (one-time or recurring charges)
-- ============================================
CREATE TABLE assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                      -- "2026 Capital Improvement", "Pool Season Assessment"
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('capital_improvement', 'seasonal', 'special', 'initiation')),
  amount NUMERIC(10,2) NOT NULL,
  -- Targeting: which members get this assessment
  target_all_members BOOLEAN NOT NULL DEFAULT FALSE,
  target_tier_ids UUID[],                   -- null = use target_all_members
  target_member_ids UUID[],                 -- specific members (overrides tier targeting)
  -- Schedule
  due_date DATE NOT NULL,
  allow_installments BOOLEAN NOT NULL DEFAULT FALSE,
  installment_count INTEGER DEFAULT 1,       -- e.g., 12 for monthly over a year
  installment_amount NUMERIC(10,2),          -- per-installment amount
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled')),
  invoices_generated BOOLEAN NOT NULL DEFAULT FALSE,
  total_assessed NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_collected NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Track per-member assessment status
CREATE TABLE assessment_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,              -- This member's assessment amount
  paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'invoiced', 'partial', 'paid', 'waived')),
  waiver_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(assessment_id, member_id)
);

-- ============================================
-- BILLING CYCLES (track automated billing runs)
-- ============================================
CREATE TABLE billing_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('dues', 'minimum_shortfall', 'assessment')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  invoices_created INTEGER NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  error_message TEXT,
  run_by UUID NOT NULL REFERENCES members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================
-- FAMILY BILLING CONFIG
-- ============================================
-- Add consolidated billing flag to families table
ALTER TABLE families ADD COLUMN IF NOT EXISTS billing_consolidated BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE families ADD COLUMN IF NOT EXISTS billing_email TEXT;

-- ============================================
-- MEMBER CREDITS/ADJUSTMENTS
-- ============================================
CREATE TABLE billing_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,     -- Positive = credit, negative = debit
  reason TEXT NOT NULL,
  applied_to_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_spending_minimums_club ON spending_minimums(club_id);
CREATE INDEX idx_spending_minimums_tier ON spending_minimums(tier_id);
CREATE INDEX idx_spending_tracking_member ON spending_tracking(member_id, period_start);
CREATE INDEX idx_spending_tracking_minimum ON spending_tracking(minimum_id);
CREATE INDEX idx_assessments_club ON assessments(club_id, status);
CREATE INDEX idx_assessment_members_assessment ON assessment_members(assessment_id);
CREATE INDEX idx_assessment_members_member ON assessment_members(member_id);
CREATE INDEX idx_billing_cycles_club ON billing_cycles(club_id, period_start);
CREATE INDEX idx_billing_credits_member ON billing_credits(member_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE spending_minimums ENABLE ROW LEVEL SECURITY;
ALTER TABLE spending_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_credits ENABLE ROW LEVEL SECURITY;

-- Spending minimums: admin-only write, all members can read (to see their own requirements)
CREATE POLICY "Members can view spending minimums" ON spending_minimums FOR SELECT
  USING (club_id = get_member_club_id());

CREATE POLICY "Admins can manage spending minimums" ON spending_minimums FOR ALL
  USING (club_id = get_member_club_id() AND is_club_admin());

-- Spending tracking: members see own, admins see all
CREATE POLICY "Members can view own spending tracking" ON spending_tracking FOR SELECT
  USING (
    club_id = get_member_club_id()
    AND (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()) OR is_club_admin())
  );

CREATE POLICY "Admins can manage spending tracking" ON spending_tracking FOR ALL
  USING (club_id = get_member_club_id() AND is_club_admin());

-- Assessments: members can view active, admins can manage
CREATE POLICY "Members can view assessments" ON assessments FOR SELECT
  USING (club_id = get_member_club_id());

CREATE POLICY "Admins can manage assessments" ON assessments FOR ALL
  USING (club_id = get_member_club_id() AND is_club_admin());

-- Assessment members: members see own, admins see all
CREATE POLICY "Members can view own assessment status" ON assessment_members FOR SELECT
  USING (
    member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
    OR is_club_admin()
  );

CREATE POLICY "Admins can manage assessment members" ON assessment_members FOR ALL
  USING (is_club_admin());

-- Billing cycles: admin only
CREATE POLICY "Admins can view billing cycles" ON billing_cycles FOR SELECT
  USING (club_id = get_member_club_id() AND is_club_admin());

CREATE POLICY "Admins can manage billing cycles" ON billing_cycles FOR ALL
  USING (club_id = get_member_club_id() AND is_club_admin());

-- Billing credits: members see own, admins manage
CREATE POLICY "Members can view own credits" ON billing_credits FOR SELECT
  USING (
    club_id = get_member_club_id()
    AND (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()) OR is_club_admin())
  );

CREATE POLICY "Admins can manage credits" ON billing_credits FOR ALL
  USING (club_id = get_member_club_id() AND is_club_admin());

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
CREATE TRIGGER set_updated_at BEFORE UPDATE ON spending_minimums
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON spending_tracking
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON assessments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON assessment_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

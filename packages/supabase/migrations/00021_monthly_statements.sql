-- ============================================
-- 00021: Monthly Statements
-- Adds monthly_statements table to track statement
-- generation runs, and statement_line_items for
-- itemized breakdowns per member statement.
-- ============================================

-- Monthly statement generation runs (one per club per period)
CREATE TABLE monthly_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  period TEXT NOT NULL,                         -- YYYY-MM
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  members_processed INT NOT NULL DEFAULT 0,
  statements_sent INT NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  error_message TEXT,
  run_by UUID REFERENCES members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (club_id, period)
);

-- Individual member statement records
CREATE TABLE member_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_run_id UUID NOT NULL REFERENCES monthly_statements(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  period TEXT NOT NULL,                         -- YYYY-MM
  -- Rollup amounts
  dues_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  charges_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  assessments_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  credits_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  previous_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_due NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Tracking
  invoice_ids UUID[] NOT NULL DEFAULT '{}',     -- all invoices included
  email_sent BOOLEAN NOT NULL DEFAULT FALSE,
  email_sent_at TIMESTAMPTZ,
  pdf_generated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (club_id, member_id, period)
);

-- Enable RLS
ALTER TABLE monthly_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_statements ENABLE ROW LEVEL SECURITY;

-- RLS policies: admin/staff can see all club statements
CREATE POLICY "Club members can view own club statements"
  ON monthly_statements FOR SELECT
  USING (club_id = get_member_club_id());

CREATE POLICY "Admins can manage statements"
  ON monthly_statements FOR ALL
  USING (is_club_admin());

CREATE POLICY "Members can view own statements"
  ON member_statements FOR SELECT
  USING (member_id = auth.uid() OR club_id = get_member_club_id() AND is_club_admin());

CREATE POLICY "Admins can manage member statements"
  ON member_statements FOR ALL
  USING (is_club_admin());

-- Indexes
CREATE INDEX idx_monthly_statements_club_period ON monthly_statements(club_id, period);
CREATE INDEX idx_member_statements_member ON member_statements(member_id, period);
CREATE INDEX idx_member_statements_run ON member_statements(statement_run_id);

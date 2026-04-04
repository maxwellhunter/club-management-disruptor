-- ============================================
-- Guest Management: Registration, Policies, Tracking, Fees
-- ============================================

-- ============================================
-- GUEST POLICIES (per club, configurable limits)
-- ============================================
CREATE TABLE guest_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                         -- "Standard Guest Policy", "Golf Guest Policy"
  facility_type TEXT,                          -- null = all facilities, or "golf", "dining", etc.
  max_guests_per_visit INTEGER NOT NULL DEFAULT 4,
  max_guest_visits_per_month INTEGER,          -- null = unlimited
  max_same_guest_per_month INTEGER DEFAULT 4,  -- How often same guest can visit
  guest_fee NUMERIC(10,2) NOT NULL DEFAULT 0,  -- Per-guest fee
  require_member_present BOOLEAN NOT NULL DEFAULT TRUE,
  blackout_days INTEGER[] DEFAULT '{}',        -- day_of_week (0=Sun) when no guests allowed
  advance_registration_required BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- GUESTS (registered guest profiles)
-- ============================================
CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  block_reason TEXT,
  total_visits INTEGER NOT NULL DEFAULT 0,
  last_visit_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(club_id, email)
);

-- ============================================
-- GUEST VISITS (every time a guest comes to the club)
-- ============================================
CREATE TABLE guest_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  host_member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
  facility_type TEXT,                           -- which facility they visited
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  guest_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  fee_invoiced BOOLEAN NOT NULL DEFAULT FALSE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'checked_in', 'checked_out', 'no_show', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- GUEST FEE SCHEDULE (per facility type, per tier)
-- ============================================
CREATE TABLE guest_fee_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  facility_type TEXT NOT NULL,                 -- "golf", "dining", "pool", "tennis", "fitness"
  tier_id UUID REFERENCES membership_tiers(id) ON DELETE SET NULL, -- null = all tiers
  guest_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  weekend_surcharge NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_guest_policies_club ON guest_policies(club_id);
CREATE INDEX idx_guests_club ON guests(club_id);
CREATE INDEX idx_guests_email ON guests(club_id, email);
CREATE INDEX idx_guest_visits_club_date ON guest_visits(club_id, visit_date);
CREATE INDEX idx_guest_visits_guest ON guest_visits(guest_id);
CREATE INDEX idx_guest_visits_host ON guest_visits(host_member_id);
CREATE INDEX idx_guest_fee_schedules_club ON guest_fee_schedules(club_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE guest_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_fee_schedules ENABLE ROW LEVEL SECURITY;

-- Guest policies: all members can read, admins can manage
CREATE POLICY "Members can view guest policies" ON guest_policies FOR SELECT
  USING (club_id = get_member_club_id());
CREATE POLICY "Admins can manage guest policies" ON guest_policies FOR ALL
  USING (club_id = get_member_club_id() AND is_club_admin());

-- Guests: all members can view, admins can manage
CREATE POLICY "Members can view guests" ON guests FOR SELECT
  USING (club_id = get_member_club_id());
CREATE POLICY "Admins can manage guests" ON guests FOR ALL
  USING (club_id = get_member_club_id() AND is_club_admin());
-- Members can register guests (insert)
CREATE POLICY "Members can register guests" ON guests FOR INSERT
  WITH CHECK (club_id = get_member_club_id());

-- Guest visits: members see own, admins see all
CREATE POLICY "Members can view guest visits" ON guest_visits FOR SELECT
  USING (
    club_id = get_member_club_id()
    AND (host_member_id IN (SELECT id FROM members WHERE user_id = auth.uid()) OR is_club_admin())
  );
CREATE POLICY "Members can create guest visits" ON guest_visits FOR INSERT
  WITH CHECK (club_id = get_member_club_id());
CREATE POLICY "Members can update own guest visits" ON guest_visits FOR UPDATE
  USING (
    club_id = get_member_club_id()
    AND (host_member_id IN (SELECT id FROM members WHERE user_id = auth.uid()) OR is_club_admin())
  );
CREATE POLICY "Admins can manage all guest visits" ON guest_visits FOR ALL
  USING (club_id = get_member_club_id() AND is_club_admin());

-- Fee schedules: all can read, admins manage
CREATE POLICY "Members can view fee schedules" ON guest_fee_schedules FOR SELECT
  USING (club_id = get_member_club_id());
CREATE POLICY "Admins can manage fee schedules" ON guest_fee_schedules FOR ALL
  USING (club_id = get_member_club_id() AND is_club_admin());

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
CREATE TRIGGER set_updated_at BEFORE UPDATE ON guest_policies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON guests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON guest_visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

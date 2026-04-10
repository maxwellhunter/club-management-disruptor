-- ============================================
-- Migration 00018: Booking Players & Player Rates
-- Per-player tracking for tee times + tier-based pricing
-- ============================================

-- ============================================
-- GOLF PLAYER RATES
-- Per-tier pricing for golf (replaces flat member/guest split)
-- Admin configures: what does each tier pay? what do guests pay?
-- ============================================
CREATE TABLE golf_player_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                              -- "Golf Member Weekday", "Social Member Weekend", etc.
  tier_id UUID REFERENCES membership_tiers(id) ON DELETE SET NULL, -- null = guest rate
  is_guest BOOLEAN NOT NULL DEFAULT FALSE,         -- true = this rate applies to guests
  day_type golf_day_type NOT NULL DEFAULT 'weekday',
  time_type golf_time_type NOT NULL DEFAULT 'prime',
  holes golf_holes NOT NULL DEFAULT '18',
  greens_fee NUMERIC(10,2) NOT NULL DEFAULT 0,     -- per player
  cart_fee NUMERIC(10,2) NOT NULL DEFAULT 0,       -- per rider
  caddie_fee NUMERIC(10,2) NOT NULL DEFAULT 0,     -- optional
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A tier or guest can only have one rate per facility/day/time/holes combo
  UNIQUE NULLS NOT DISTINCT (facility_id, tier_id, is_guest, day_type, time_type, holes)
);

CREATE TRIGGER set_golf_player_rates_updated_at
  BEFORE UPDATE ON golf_player_rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- BOOKING PLAYERS
-- Each player in a tee time (members, social members, guests)
-- ============================================
CREATE TYPE booking_player_type AS ENUM ('member', 'guest');

CREATE TABLE booking_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  player_type booking_player_type NOT NULL DEFAULT 'member',
  -- For club members
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  -- For guests (registered or ad-hoc)
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  guest_name TEXT,                                  -- fallback if no guest record
  -- Pricing snapshot at booking time
  greens_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  cart_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  caddie_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  rate_id UUID REFERENCES golf_player_rates(id) ON DELETE SET NULL, -- which rate was applied
  -- Billing
  fee_invoiced BOOLEAN NOT NULL DEFAULT FALSE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (booking_id, member_id),                   -- a member can only be in a booking once
  -- Must have either member_id, guest_id, or guest_name
  CHECK (
    member_id IS NOT NULL
    OR guest_id IS NOT NULL
    OR guest_name IS NOT NULL
  )
);

-- Indexes
CREATE INDEX idx_golf_player_rates_club ON golf_player_rates(club_id, facility_id, is_active);
CREATE INDEX idx_golf_player_rates_lookup ON golf_player_rates(facility_id, day_type, time_type, holes, is_active);
CREATE INDEX idx_booking_players_booking ON booking_players(booking_id);
CREATE INDEX idx_booking_players_member ON booking_players(member_id) WHERE member_id IS NOT NULL;
CREATE INDEX idx_booking_players_guest ON booking_players(guest_id) WHERE guest_id IS NOT NULL;

-- ============================================
-- Row-Level Security
-- ============================================
ALTER TABLE golf_player_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_players ENABLE ROW LEVEL SECURITY;

-- Golf player rates: all members can view their club's rates
CREATE POLICY "Members can view player rates"
  ON golf_player_rates FOR SELECT
  USING (club_id = get_member_club_id());

-- Admins can manage player rates
CREATE POLICY "Admins can manage player rates"
  ON golf_player_rates FOR ALL
  USING (club_id = get_member_club_id() AND is_club_admin());

-- Booking players: members can see players in their own bookings
CREATE POLICY "Members can view own booking players"
  ON booking_players FOR SELECT
  USING (booking_id IN (
    SELECT id FROM bookings WHERE member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  ));

-- Members can manage players in their own bookings
CREATE POLICY "Members can manage own booking players"
  ON booking_players FOR ALL
  USING (booking_id IN (
    SELECT id FROM bookings WHERE member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  ));

-- Admins can see/manage all booking players
CREATE POLICY "Admins can manage all booking players"
  ON booking_players FOR ALL
  USING (booking_id IN (
    SELECT id FROM bookings
    WHERE club_id = get_member_club_id() AND is_club_admin()
  ));

-- ============================================
-- Seed: Default player rates for Greenfield CC
-- Championship Course (facility 00000000-0000-0000-0000-000000000101)
-- ============================================

-- Golf tier (premium) — included in dues
INSERT INTO golf_player_rates (club_id, facility_id, name, tier_id, is_guest, day_type, time_type, holes, greens_fee, cart_fee) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'Golf Member — Weekday Prime 18', '00000000-0000-0000-0000-000000000202', FALSE, 'weekday', 'prime', '18', 0, 0),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'Golf Member — Weekend Prime 18', '00000000-0000-0000-0000-000000000202', FALSE, 'weekend', 'prime', '18', 0, 0);

-- Platinum tier (vip) — included in dues
INSERT INTO golf_player_rates (club_id, facility_id, name, tier_id, is_guest, day_type, time_type, holes, greens_fee, cart_fee) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'Platinum Member — Weekday Prime 18', '00000000-0000-0000-0000-000000000203', FALSE, 'weekday', 'prime', '18', 0, 0),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'Platinum Member — Weekend Prime 18', '00000000-0000-0000-0000-000000000203', FALSE, 'weekend', 'prime', '18', 0, 0);

-- Standard tier (social member) — pays greens fee
INSERT INTO golf_player_rates (club_id, facility_id, name, tier_id, is_guest, day_type, time_type, holes, greens_fee, cart_fee) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'Social Member — Weekday Prime 18', '00000000-0000-0000-0000-000000000201', FALSE, 'weekday', 'prime', '18', 65.00, 25.00),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'Social Member — Weekend Prime 18', '00000000-0000-0000-0000-000000000201', FALSE, 'weekend', 'prime', '18', 85.00, 25.00);

-- Legacy tier (honorary) — included in dues
INSERT INTO golf_player_rates (club_id, facility_id, name, tier_id, is_guest, day_type, time_type, holes, greens_fee, cart_fee) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'Legacy Member — Weekday Prime 18', '00000000-0000-0000-0000-000000000204', FALSE, 'weekday', 'prime', '18', 0, 0),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'Legacy Member — Weekend Prime 18', '00000000-0000-0000-0000-000000000204', FALSE, 'weekend', 'prime', '18', 0, 0);

-- Guest rates
INSERT INTO golf_player_rates (club_id, facility_id, name, tier_id, is_guest, day_type, time_type, holes, greens_fee, cart_fee) VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'Guest — Weekday Prime 18', NULL, TRUE, 'weekday', 'prime', '18', 125.00, 30.00),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000101', 'Guest — Weekend Prime 18', NULL, TRUE, 'weekend', 'prime', '18', 150.00, 30.00);

-- ============================================
-- Golf Rates: per-round pricing for golf facilities
-- ============================================

CREATE TYPE golf_day_type AS ENUM ('weekday', 'weekend');
CREATE TYPE golf_time_type AS ENUM ('prime', 'afternoon', 'twilight');
CREATE TYPE golf_holes AS ENUM ('9', '18');

CREATE TABLE golf_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  holes golf_holes NOT NULL DEFAULT '18',
  day_type golf_day_type NOT NULL DEFAULT 'weekday',
  time_type golf_time_type NOT NULL DEFAULT 'prime',
  member_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  guest_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  cart_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE TRIGGER set_golf_rates_updated_at
  BEFORE UPDATE ON golf_rates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE golf_rates ENABLE ROW LEVEL SECURITY;

-- All members can read rates for their club
CREATE POLICY "Members can view golf rates"
  ON golf_rates FOR SELECT
  USING (club_id = get_member_club_id());

-- Only admins can insert
CREATE POLICY "Admins can insert golf rates"
  ON golf_rates FOR INSERT
  WITH CHECK (
    club_id = get_member_club_id()
    AND is_club_admin()
  );

-- Only admins can update
CREATE POLICY "Admins can update golf rates"
  ON golf_rates FOR UPDATE
  USING (
    club_id = get_member_club_id()
    AND is_club_admin()
  );

-- Only admins can delete
CREATE POLICY "Admins can delete golf rates"
  ON golf_rates FOR DELETE
  USING (
    club_id = get_member_club_id()
    AND is_club_admin()
  );

-- Index for fast lookups
CREATE INDEX idx_golf_rates_club_facility ON golf_rates(club_id, facility_id);
CREATE INDEX idx_golf_rates_active ON golf_rates(club_id, is_active) WHERE is_active = true;

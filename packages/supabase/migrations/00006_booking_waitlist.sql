-- ============================================
-- Booking Waitlist
-- ============================================

CREATE TABLE IF NOT EXISTS booking_waitlist (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  member_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  date        date NOT NULL,
  start_time  time NOT NULL,
  end_time    time NOT NULL,
  party_size  int NOT NULL DEFAULT 4 CHECK (party_size >= 1 AND party_size <= 4),
  position    int NOT NULL DEFAULT 1,
  status      text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'promoted', 'expired', 'cancelled')),
  notified_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Prevent duplicate waitlist entries (same member, same slot)
CREATE UNIQUE INDEX idx_waitlist_unique_entry
  ON booking_waitlist (facility_id, date, start_time, member_id)
  WHERE status = 'waiting';

-- Fast lookup: who's waiting for a specific slot?
CREATE INDEX idx_waitlist_slot_lookup
  ON booking_waitlist (facility_id, date, start_time, status, position);

-- Auto-update updated_at
CREATE TRIGGER set_waitlist_updated_at
  BEFORE UPDATE ON booking_waitlist
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- RLS Policies
-- ============================================
ALTER TABLE booking_waitlist ENABLE ROW LEVEL SECURITY;

-- Members can see their own waitlist entries
CREATE POLICY "Members can view own waitlist entries"
  ON booking_waitlist FOR SELECT
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

-- Members can insert waitlist entries for their club
CREATE POLICY "Members can join waitlist"
  ON booking_waitlist FOR INSERT
  WITH CHECK (
    club_id = get_member_club_id()
    AND member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  );

-- Members can cancel their own waitlist entries
CREATE POLICY "Members can cancel own waitlist entries"
  ON booking_waitlist FOR UPDATE
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()))
  WITH CHECK (status IN ('cancelled'));

-- Admins can manage all waitlist entries
CREATE POLICY "Admins can manage waitlist"
  ON booking_waitlist FOR ALL
  USING (is_club_admin())
  WITH CHECK (is_club_admin());

-- Service role needs full access for auto-promotion
CREATE POLICY "Service role full access to waitlist"
  ON booking_waitlist FOR ALL
  USING (auth.role() = 'service_role');

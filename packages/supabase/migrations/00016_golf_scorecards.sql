-- ============================================
-- Migration 00009: Golf Scorecards
-- Course hole layouts + round scoring
-- ============================================

-- Course hole definitions (par, yardage, handicap index per hole)
CREATE TABLE course_holes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  hole_number INT NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  par INT NOT NULL CHECK (par BETWEEN 3 AND 6),
  yardage_back INT NOT NULL CHECK (yardage_back > 0),
  yardage_middle INT CHECK (yardage_middle > 0),
  yardage_forward INT CHECK (yardage_forward > 0),
  handicap_index INT NOT NULL CHECK (handicap_index BETWEEN 1 AND 18),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (facility_id, hole_number)
);

-- A played round of golf
CREATE TABLE golf_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  played_at DATE NOT NULL DEFAULT CURRENT_DATE,
  tee_set TEXT NOT NULL DEFAULT 'middle' CHECK (tee_set IN ('back', 'middle', 'forward')),
  holes_played INT NOT NULL DEFAULT 18 CHECK (holes_played IN (9, 18)),
  total_score INT,
  total_putts INT,
  total_fairways_hit INT,
  total_greens_in_regulation INT,
  weather TEXT CHECK (weather IN ('sunny', 'cloudy', 'windy', 'rainy', 'cold')),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'verified', 'cancelled')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-hole scores within a round
CREATE TABLE golf_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES golf_rounds(id) ON DELETE CASCADE,
  hole_number INT NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  strokes INT CHECK (strokes BETWEEN 1 AND 20),
  putts INT CHECK (putts BETWEEN 0 AND 10),
  fairway_hit BOOLEAN,         -- null for par 3s
  green_in_regulation BOOLEAN,
  penalty_strokes INT DEFAULT 0 CHECK (penalty_strokes >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (round_id, hole_number)
);

-- Indexes
CREATE INDEX idx_golf_rounds_member ON golf_rounds(member_id, played_at DESC);
CREATE INDEX idx_golf_rounds_club ON golf_rounds(club_id, played_at DESC);
CREATE INDEX idx_golf_rounds_facility ON golf_rounds(facility_id, played_at DESC);
CREATE INDEX idx_golf_scores_round ON golf_scores(round_id, hole_number);
CREATE INDEX idx_course_holes_facility ON course_holes(facility_id, hole_number);

-- Auto-update updated_at
CREATE TRIGGER set_golf_rounds_updated_at
  BEFORE UPDATE ON golf_rounds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_golf_scores_updated_at
  BEFORE UPDATE ON golf_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Row-Level Security
-- ============================================

ALTER TABLE course_holes ENABLE ROW LEVEL SECURITY;
ALTER TABLE golf_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE golf_scores ENABLE ROW LEVEL SECURITY;

-- Course holes: all members can view their club's course holes
CREATE POLICY "Members can view course holes"
  ON course_holes FOR SELECT
  USING (facility_id IN (
    SELECT f.id FROM facilities f WHERE f.club_id = get_member_club_id()
  ));

-- Admins can manage course holes
CREATE POLICY "Admins can manage course holes"
  ON course_holes FOR ALL
  USING (
    is_club_admin() AND
    facility_id IN (
      SELECT f.id FROM facilities f WHERE f.club_id = get_member_club_id()
    )
  );

-- Golf rounds: members can view/manage their own rounds
CREATE POLICY "Members can view own rounds"
  ON golf_rounds FOR SELECT
  USING (member_id IN (
    SELECT id FROM members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can create own rounds"
  ON golf_rounds FOR INSERT
  WITH CHECK (member_id IN (
    SELECT id FROM members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Members can update own rounds"
  ON golf_rounds FOR UPDATE
  USING (member_id IN (
    SELECT id FROM members WHERE user_id = auth.uid()
  ));

-- Admins can view all rounds in their club
CREATE POLICY "Admins can view all club rounds"
  ON golf_rounds FOR SELECT
  USING (is_club_admin() AND club_id = get_member_club_id());

-- Admins can manage all rounds
CREATE POLICY "Admins can manage all club rounds"
  ON golf_rounds FOR ALL
  USING (is_club_admin() AND club_id = get_member_club_id());

-- Golf scores: follow parent round access
CREATE POLICY "Members can view own scores"
  ON golf_scores FOR SELECT
  USING (round_id IN (
    SELECT id FROM golf_rounds WHERE member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Members can manage own scores"
  ON golf_scores FOR ALL
  USING (round_id IN (
    SELECT id FROM golf_rounds WHERE member_id IN (
      SELECT id FROM members WHERE user_id = auth.uid()
    )
  ));

CREATE POLICY "Admins can view all club scores"
  ON golf_scores FOR SELECT
  USING (round_id IN (
    SELECT id FROM golf_rounds
    WHERE is_club_admin() AND club_id = get_member_club_id()
  ));

-- ============================================
-- Seed: Championship Course hole layout
-- Classic 18-hole championship course (par 72)
-- ============================================
INSERT INTO course_holes (facility_id, hole_number, par, yardage_back, yardage_middle, yardage_forward, handicap_index) VALUES
  -- Front 9 (par 36)
  ('00000000-0000-0000-0000-000000000101', 1,  4, 415, 385, 340, 7),
  ('00000000-0000-0000-0000-000000000101', 2,  3, 185, 165, 130, 15),
  ('00000000-0000-0000-0000-000000000101', 3,  5, 540, 510, 465, 3),
  ('00000000-0000-0000-0000-000000000101', 4,  4, 430, 400, 360, 1),
  ('00000000-0000-0000-0000-000000000101', 5,  4, 380, 355, 315, 11),
  ('00000000-0000-0000-0000-000000000101', 6,  3, 210, 185, 150, 13),
  ('00000000-0000-0000-0000-000000000101', 7,  4, 445, 415, 375, 5),
  ('00000000-0000-0000-0000-000000000101', 8,  5, 560, 530, 480, 9),
  ('00000000-0000-0000-0000-000000000101', 9,  4, 400, 375, 335, 17),
  -- Back 9 (par 36)
  ('00000000-0000-0000-0000-000000000101', 10, 4, 425, 395, 355, 6),
  ('00000000-0000-0000-0000-000000000101', 11, 3, 195, 175, 140, 16),
  ('00000000-0000-0000-0000-000000000101', 12, 5, 555, 525, 475, 2),
  ('00000000-0000-0000-0000-000000000101', 13, 4, 410, 380, 340, 8),
  ('00000000-0000-0000-0000-000000000101', 14, 4, 390, 365, 325, 10),
  ('00000000-0000-0000-0000-000000000101', 15, 3, 220, 195, 160, 14),
  ('00000000-0000-0000-0000-000000000101', 16, 5, 535, 505, 460, 4),
  ('00000000-0000-0000-0000-000000000101', 17, 4, 450, 420, 380, 12),
  ('00000000-0000-0000-0000-000000000101', 18, 4, 435, 405, 365, 18);

-- Executive 9 hole layout (par 32 — three par-3s, five par-4s, one par-5)
INSERT INTO course_holes (facility_id, hole_number, par, yardage_back, yardage_middle, yardage_forward, handicap_index) VALUES
  ('00000000-0000-0000-0000-000000000102', 1, 4, 320, 295, 260, 3),
  ('00000000-0000-0000-0000-000000000102', 2, 3, 155, 140, 115, 7),
  ('00000000-0000-0000-0000-000000000102', 3, 4, 345, 320, 285, 1),
  ('00000000-0000-0000-0000-000000000102', 4, 3, 170, 150, 125, 9),
  ('00000000-0000-0000-0000-000000000102', 5, 5, 480, 450, 410, 5),
  ('00000000-0000-0000-0000-000000000102', 6, 4, 335, 310, 275, 2),
  ('00000000-0000-0000-0000-000000000102', 7, 4, 360, 335, 300, 4),
  ('00000000-0000-0000-0000-000000000102', 8, 3, 145, 130, 110, 8),
  ('00000000-0000-0000-0000-000000000102', 9, 4, 350, 325, 290, 6);

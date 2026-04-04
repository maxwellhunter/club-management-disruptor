-- ============================================
-- 00015: Digital Member Cards & NFC
-- ============================================
-- Tracks digital wallet passes (Apple/Google), NFC tap history,
-- and card provisioning status for each member.

-- Digital pass records (Apple Wallet / Google Wallet)
CREATE TABLE IF NOT EXISTS digital_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('apple', 'google')),
  pass_serial TEXT NOT NULL,
  pass_type_id TEXT,            -- Apple: pass type identifier; Google: class ID
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'revoked', 'expired')),
  device_library_id TEXT,       -- Apple: device library identifier
  push_token TEXT,              -- Apple: push token for pass updates
  barcode_payload TEXT NOT NULL, -- encoded member identifier for scanning
  last_updated_tag TEXT,        -- Apple: If-Modified-Since tag
  metadata JSONB DEFAULT '{}',  -- extra platform-specific data
  installed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, platform)
);

-- NFC tap / scan log
CREATE TABLE IF NOT EXISTS nfc_tap_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  facility_id UUID REFERENCES facilities(id),
  tap_type TEXT NOT NULL DEFAULT 'check_in' CHECK (tap_type IN ('check_in', 'pos_payment', 'access_gate', 'event_entry')),
  location TEXT,                -- human-readable location name
  device_id TEXT,               -- reader device identifier
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  verified BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Card design templates (per club, for branded passes)
CREATE TABLE IF NOT EXISTS card_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default',
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Apple Wallet style
  apple_background_color TEXT DEFAULT '#16a34a',
  apple_foreground_color TEXT DEFAULT '#ffffff',
  apple_label_color TEXT DEFAULT '#ffffff',
  -- Google Wallet style
  google_hex_background TEXT DEFAULT '#16a34a',
  google_logo_url TEXT,
  -- Shared
  logo_url TEXT,
  hero_image_url TEXT,
  description TEXT DEFAULT 'Club Membership Card',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_digital_passes_club ON digital_passes(club_id);
CREATE INDEX IF NOT EXISTS idx_digital_passes_member ON digital_passes(member_id);
CREATE INDEX IF NOT EXISTS idx_digital_passes_serial ON digital_passes(pass_serial);
CREATE INDEX IF NOT EXISTS idx_nfc_tap_log_club ON nfc_tap_log(club_id);
CREATE INDEX IF NOT EXISTS idx_nfc_tap_log_member ON nfc_tap_log(member_id);
CREATE INDEX IF NOT EXISTS idx_nfc_tap_log_created ON nfc_tap_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_templates_club ON card_templates(club_id);

-- RLS
ALTER TABLE digital_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE nfc_tap_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_templates ENABLE ROW LEVEL SECURITY;

-- digital_passes: members see own, admins see all
CREATE POLICY "Members view own passes"
  ON digital_passes FOR SELECT
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

CREATE POLICY "Admins manage passes"
  ON digital_passes FOR ALL
  USING (club_id = get_member_club_id());

-- nfc_tap_log: members see own, admins see all
CREATE POLICY "Members view own taps"
  ON nfc_tap_log FOR SELECT
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

CREATE POLICY "Admins manage tap log"
  ON nfc_tap_log FOR ALL
  USING (club_id = get_member_club_id());

-- card_templates: all club members can view, admins manage
CREATE POLICY "Members view templates"
  ON card_templates FOR SELECT
  USING (club_id = get_member_club_id());

CREATE POLICY "Admins manage templates"
  ON card_templates FOR ALL
  USING (is_club_admin());

-- Auto-update triggers
CREATE TRIGGER set_digital_passes_updated_at
  BEFORE UPDATE ON digital_passes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_card_templates_updated_at
  BEFORE UPDATE ON card_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

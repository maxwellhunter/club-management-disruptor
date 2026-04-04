-- ============================================
-- Push Notifications: Server-side sending infrastructure
-- ============================================

-- Add push token to members
ALTER TABLE members ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Notification preferences (per member, per category)
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  category TEXT NOT NULL,  -- "bookings", "events", "announcements", "billing", "dining", "marketing", "guests"
  push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  email_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(member_id, category)
);

-- Notification log (audit trail of sent notifications)
CREATE TABLE notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,                   -- Deep link data, etc.
  channel TEXT NOT NULL DEFAULT 'push' CHECK (channel IN ('push', 'email', 'in_app')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'skipped')),
  error_message TEXT,
  expo_receipt_id TEXT,         -- Expo push receipt for delivery tracking
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notification templates (reusable notification content)
CREATE TABLE notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  title_template TEXT NOT NULL,   -- Supports {{variable}} placeholders
  body_template TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_members_push_token ON members(push_token) WHERE push_token IS NOT NULL;
CREATE INDEX idx_notification_preferences_member ON notification_preferences(member_id);
CREATE INDEX idx_notification_log_club ON notification_log(club_id, created_at);
CREATE INDEX idx_notification_log_member ON notification_log(member_id, created_at);
CREATE INDEX idx_notification_templates_club ON notification_templates(club_id, category);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- Preferences: members manage their own
CREATE POLICY "Members can view own preferences" ON notification_preferences FOR SELECT
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));
CREATE POLICY "Members can manage own preferences" ON notification_preferences FOR ALL
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

-- Log: members see own, admins see all
CREATE POLICY "Members can view own notifications" ON notification_log FOR SELECT
  USING (
    club_id = get_member_club_id()
    AND (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()) OR is_club_admin())
  );
CREATE POLICY "Admins can manage notification log" ON notification_log FOR ALL
  USING (club_id = get_member_club_id() AND is_club_admin());

-- Templates: admins only
CREATE POLICY "Members can view templates" ON notification_templates FOR SELECT
  USING (club_id = get_member_club_id());
CREATE POLICY "Admins can manage templates" ON notification_templates FOR ALL
  USING (club_id = get_member_club_id() AND is_club_admin());

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
CREATE TRIGGER set_updated_at BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

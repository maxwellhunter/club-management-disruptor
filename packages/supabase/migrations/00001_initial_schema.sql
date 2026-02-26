-- ============================================
-- ClubOS Database Schema
-- Multi-tenant country club management
-- ============================================

-- gen_random_uuid() is built into Postgres 17+, no extension needed

-- ============================================
-- CLUBS (Multi-tenant root)
-- ============================================
CREATE TABLE clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  stripe_account_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- MEMBERSHIP TIERS
-- ============================================
CREATE TABLE membership_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('standard', 'premium', 'vip', 'honorary')),
  description TEXT,
  monthly_dues NUMERIC(10,2) NOT NULL DEFAULT 0,
  annual_dues NUMERIC(10,2),
  benefits JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- FAMILIES
-- ============================================
CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  primary_member_id UUID, -- Set after members table exists
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- MEMBERS
-- ============================================
CREATE TABLE members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  member_number TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'staff', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending')),
  membership_tier_id UUID REFERENCES membership_tiers(id) ON DELETE SET NULL,
  family_id UUID REFERENCES families(id) ON DELETE SET NULL,
  join_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(club_id, email),
  UNIQUE(club_id, member_number)
);

-- Add FK for families.primary_member_id
ALTER TABLE families
  ADD CONSTRAINT fk_families_primary_member
  FOREIGN KEY (primary_member_id) REFERENCES members(id) ON DELETE SET NULL;

-- ============================================
-- FACILITIES
-- ============================================
CREATE TABLE facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('golf', 'tennis', 'dining', 'pool', 'fitness', 'other')),
  description TEXT,
  capacity INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- BOOKING SLOTS (weekly recurring availability)
-- ============================================
CREATE TABLE booking_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_bookings INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (start_time < end_time)
);

-- ============================================
-- BOOKINGS
-- ============================================
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'pending', 'cancelled', 'completed', 'no_show')),
  party_size INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- EVENTS
-- ============================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  capacity INTEGER,
  price NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
  image_url TEXT,
  created_by UUID NOT NULL REFERENCES members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- EVENT RSVPs
-- ============================================
CREATE TABLE event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'attending' CHECK (status IN ('attending', 'declined', 'maybe', 'waitlisted')),
  guest_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, member_id)
);

-- ============================================
-- INVOICES
-- ============================================
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT,
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled', 'void')),
  description TEXT NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- PAYMENTS
-- ============================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  stripe_payment_id TEXT,
  amount NUMERIC(10,2) NOT NULL,
  method TEXT NOT NULL DEFAULT 'card' CHECK (method IN ('card', 'ach', 'check', 'cash', 'other')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- ANNOUNCEMENTS
-- ============================================
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  target_tier_ids UUID[],
  published_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- CHAT CONVERSATIONS & MESSAGES
-- ============================================
CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_members_club_id ON members(club_id);
CREATE INDEX idx_members_user_id ON members(user_id);
CREATE INDEX idx_members_email ON members(club_id, email);
CREATE INDEX idx_members_status ON members(club_id, status);
CREATE INDEX idx_bookings_club_date ON bookings(club_id, date);
CREATE INDEX idx_bookings_member ON bookings(member_id);
CREATE INDEX idx_bookings_facility_date ON bookings(facility_id, date);
CREATE INDEX idx_events_club_date ON events(club_id, start_date);
CREATE INDEX idx_invoices_club_member ON invoices(club_id, member_id);
CREATE INDEX idx_invoices_status ON invoices(club_id, status);
CREATE INDEX idx_payments_member ON payments(member_id);
CREATE INDEX idx_announcements_club ON announcements(club_id, published_at);
CREATE INDEX idx_chat_conversations_member ON chat_conversations(member_id);
CREATE INDEX idx_chat_messages_conversation ON chat_messages(conversation_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Helper function: get member's club_id from auth.uid()
CREATE OR REPLACE FUNCTION get_member_club_id()
RETURNS UUID AS $$
  SELECT club_id FROM members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Helper function: check if user is admin
CREATE OR REPLACE FUNCTION is_club_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Members: users can read members of their club, admins can write
CREATE POLICY "Members can view their club members"
  ON members FOR SELECT
  USING (club_id = get_member_club_id());

CREATE POLICY "Admins can insert members"
  ON members FOR INSERT
  WITH CHECK (club_id = get_member_club_id() AND is_club_admin());

CREATE POLICY "Admins can update members"
  ON members FOR UPDATE
  USING (club_id = get_member_club_id() AND is_club_admin());

-- Bookings: members can manage their own, admins can manage all
CREATE POLICY "Members can view club bookings"
  ON bookings FOR SELECT
  USING (club_id = get_member_club_id());

CREATE POLICY "Members can create bookings"
  ON bookings FOR INSERT
  WITH CHECK (club_id = get_member_club_id());

CREATE POLICY "Members can update own bookings"
  ON bookings FOR UPDATE
  USING (
    club_id = get_member_club_id()
    AND (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()) OR is_club_admin())
  );

-- Events: all club members can view, admins/staff can manage
CREATE POLICY "Members can view club events"
  ON events FOR SELECT
  USING (club_id = get_member_club_id());

CREATE POLICY "Staff can manage events"
  ON events FOR INSERT
  WITH CHECK (club_id = get_member_club_id() AND is_club_admin());

-- Chat: members can only access their own conversations
CREATE POLICY "Members can view own conversations"
  ON chat_conversations FOR SELECT
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

CREATE POLICY "Members can create conversations"
  ON chat_conversations FOR INSERT
  WITH CHECK (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

CREATE POLICY "Members can view own chat messages"
  ON chat_messages FOR SELECT
  USING (conversation_id IN (
    SELECT id FROM chat_conversations
    WHERE member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  ));

CREATE POLICY "Members can insert chat messages"
  ON chat_messages FOR INSERT
  WITH CHECK (conversation_id IN (
    SELECT id FROM chat_conversations
    WHERE member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
  ));

-- Clubs, tiers, facilities: readable by club members
CREATE POLICY "Members can view their club" ON clubs FOR SELECT
  USING (id = get_member_club_id());

CREATE POLICY "Members can view tiers" ON membership_tiers FOR SELECT
  USING (club_id = get_member_club_id());

CREATE POLICY "Members can view facilities" ON facilities FOR SELECT
  USING (club_id = get_member_club_id());

CREATE POLICY "Members can view booking slots" ON booking_slots FOR SELECT
  USING (facility_id IN (SELECT id FROM facilities WHERE club_id = get_member_club_id()));

CREATE POLICY "Members can view announcements" ON announcements FOR SELECT
  USING (club_id = get_member_club_id() AND published_at IS NOT NULL);

CREATE POLICY "Members can view invoices" ON invoices FOR SELECT
  USING (
    club_id = get_member_club_id()
    AND (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()) OR is_club_admin())
  );

CREATE POLICY "Members can view payments" ON payments FOR SELECT
  USING (
    club_id = get_member_club_id()
    AND (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()) OR is_club_admin())
  );

CREATE POLICY "Members can view families" ON families FOR SELECT
  USING (club_id = get_member_club_id());

CREATE POLICY "Members can view event RSVPs" ON event_rsvps FOR SELECT
  USING (event_id IN (SELECT id FROM events WHERE club_id = get_member_club_id()));

CREATE POLICY "Members can manage own RSVPs" ON event_rsvps FOR INSERT
  WITH CHECK (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

CREATE POLICY "Members can update own RSVPs" ON event_rsvps FOR UPDATE
  USING (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()));

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON clubs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON event_rsvps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON chat_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

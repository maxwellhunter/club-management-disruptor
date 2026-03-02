-- Migration: Multi-Tenancy Hardening
-- Adds unique constraint on members.user_id and missing RLS write/delete policies

-- ─── 1. Unique constraint on members.user_id ────────────────────────────

-- Pre-check: fail if duplicate user_id values exist
DO $$ BEGIN
  IF EXISTS (
    SELECT user_id FROM members
    WHERE user_id IS NOT NULL
    GROUP BY user_id HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate user_id values found in members table. Resolve before applying migration.';
  END IF;
END $$;

-- Partial unique index: allows multiple NULLs but only one non-null per user_id
CREATE UNIQUE INDEX members_user_id_unique ON members(user_id) WHERE user_id IS NOT NULL;

-- ─── 2. Missing RLS write/delete policies ───────────────────────────────

-- invoices: INSERT (admin only)
CREATE POLICY "Admins can create invoices"
  ON invoices FOR INSERT
  WITH CHECK (club_id = get_member_club_id() AND is_club_admin());

-- payments: INSERT (admin only)
CREATE POLICY "Admins can record payments"
  ON payments FOR INSERT
  WITH CHECK (club_id = get_member_club_id() AND is_club_admin());

-- announcements: INSERT, UPDATE, DELETE (admin only)
CREATE POLICY "Admins can create announcements"
  ON announcements FOR INSERT
  WITH CHECK (club_id = get_member_club_id() AND is_club_admin());

CREATE POLICY "Admins can update announcements"
  ON announcements FOR UPDATE
  USING (club_id = get_member_club_id() AND is_club_admin())
  WITH CHECK (club_id = get_member_club_id() AND is_club_admin());

CREATE POLICY "Admins can delete announcements"
  ON announcements FOR DELETE
  USING (club_id = get_member_club_id() AND is_club_admin());

-- families: INSERT, UPDATE (admin only)
CREATE POLICY "Admins can create families"
  ON families FOR INSERT
  WITH CHECK (club_id = get_member_club_id() AND is_club_admin());

CREATE POLICY "Admins can update families"
  ON families FOR UPDATE
  USING (club_id = get_member_club_id() AND is_club_admin())
  WITH CHECK (club_id = get_member_club_id() AND is_club_admin());

-- facilities: INSERT, UPDATE, DELETE (admin only)
CREATE POLICY "Admins can create facilities"
  ON facilities FOR INSERT
  WITH CHECK (club_id = get_member_club_id() AND is_club_admin());

CREATE POLICY "Admins can update facilities"
  ON facilities FOR UPDATE
  USING (club_id = get_member_club_id() AND is_club_admin())
  WITH CHECK (club_id = get_member_club_id() AND is_club_admin());

CREATE POLICY "Admins can delete facilities"
  ON facilities FOR DELETE
  USING (club_id = get_member_club_id() AND is_club_admin());

-- membership_tiers: INSERT, UPDATE, DELETE (admin only)
CREATE POLICY "Admins can create tiers"
  ON membership_tiers FOR INSERT
  WITH CHECK (club_id = get_member_club_id() AND is_club_admin());

CREATE POLICY "Admins can update tiers"
  ON membership_tiers FOR UPDATE
  USING (club_id = get_member_club_id() AND is_club_admin())
  WITH CHECK (club_id = get_member_club_id() AND is_club_admin());

CREATE POLICY "Admins can delete tiers"
  ON membership_tiers FOR DELETE
  USING (club_id = get_member_club_id() AND is_club_admin());

-- events: UPDATE, DELETE (admin only)
CREATE POLICY "Admins can update events"
  ON events FOR UPDATE
  USING (club_id = get_member_club_id() AND is_club_admin())
  WITH CHECK (club_id = get_member_club_id() AND is_club_admin());

CREATE POLICY "Admins can delete events"
  ON events FOR DELETE
  USING (club_id = get_member_club_id() AND is_club_admin());

-- members: DELETE (admin only)
CREATE POLICY "Admins can delete members"
  ON members FOR DELETE
  USING (club_id = get_member_club_id() AND is_club_admin());

-- bookings: DELETE (owner or admin)
CREATE POLICY "Members can delete own bookings or admin can delete any"
  ON bookings FOR DELETE
  USING (
    club_id = get_member_club_id()
    AND (
      member_id IN (SELECT id FROM members WHERE user_id = auth.uid())
      OR is_club_admin()
    )
  );

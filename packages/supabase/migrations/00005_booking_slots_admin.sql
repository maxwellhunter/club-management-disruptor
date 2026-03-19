-- ============================================
-- Admin CRUD policies for booking_slots
-- Allows club admins to manage schedules
-- ============================================

-- Admin can insert booking slots for their club's facilities
CREATE POLICY "Admins can insert booking slots"
  ON booking_slots FOR INSERT
  WITH CHECK (
    facility_id IN (
      SELECT id FROM facilities WHERE club_id = get_member_club_id()
    )
    AND is_club_admin()
  );

-- Admin can update booking slots for their club's facilities
CREATE POLICY "Admins can update booking slots"
  ON booking_slots FOR UPDATE
  USING (
    facility_id IN (
      SELECT id FROM facilities WHERE club_id = get_member_club_id()
    )
    AND is_club_admin()
  );

-- Admin can delete booking slots for their club's facilities
CREATE POLICY "Admins can delete booking slots"
  ON booking_slots FOR DELETE
  USING (
    facility_id IN (
      SELECT id FROM facilities WHERE club_id = get_member_club_id()
    )
    AND is_club_admin()
  );

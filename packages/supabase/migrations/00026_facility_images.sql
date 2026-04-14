-- Add image_url to facilities for spaces/courts browsing UI
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Helpful index for member-facing availability queries
CREATE INDEX IF NOT EXISTS idx_booking_slots_facility_dow
  ON booking_slots(facility_id, day_of_week, is_active);

-- ============================================
-- Seed Data for ClubOS Development
-- ============================================

-- Insert a demo club
INSERT INTO clubs (id, name, slug, address, phone, email, timezone)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Greenfield Country Club',
  'greenfield-cc',
  '100 Fairway Drive, Greenwich, CT 06830',
  '(203) 555-0100',
  'info@greenfieldcc.com',
  'America/New_York'
);

-- Insert membership tiers (fixed UUIDs for referencing in seed/tests)
INSERT INTO membership_tiers (id, club_id, name, level, description, monthly_dues, annual_dues, benefits) VALUES
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000001', 'Standard', 'standard', 'Basic club access with dining and pool privileges', 250.00, 2750.00, '["Pool access", "Dining room", "Social events"]'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000001', 'Golf', 'premium', 'Full golf privileges with cart access', 500.00, 5500.00, '["Unlimited golf", "Cart included", "Pool access", "Dining room", "Pro shop discount"]'),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000001', 'Platinum', 'vip', 'All-access membership with priority booking', 850.00, 9500.00, '["Unlimited golf", "Priority tee times", "Tennis courts", "Pool & fitness", "Private dining", "Guest passes"]'),
  ('00000000-0000-0000-0000-000000000204', '00000000-0000-0000-0000-000000000001', 'Legacy', 'honorary', 'Honorary membership for founding members', 0.00, 0.00, '["All club privileges", "Board voting rights", "Reserved parking"]');

-- Insert facilities (fixed UUIDs for golf courses, needed by booking_slots)
INSERT INTO facilities (id, club_id, name, type, description, capacity) VALUES
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001', 'Championship Course', 'golf', '18-hole championship course', 144),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001', 'Executive 9', 'golf', '9-hole executive course', 72),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001', 'Main Dining Room', 'dining', 'Formal dining experience', 80),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000001', 'Grill Room', 'dining', 'Casual dining and bar', 50),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000001', 'Tennis Center', 'tennis', '6 clay courts', 24),
  ('00000000-0000-0000-0000-000000000106', '00000000-0000-0000-0000-000000000001', 'Olympic Pool', 'pool', 'Heated Olympic-size pool', 100),
  ('00000000-0000-0000-0000-000000000107', '00000000-0000-0000-0000-000000000001', 'Fitness Center', 'fitness', 'Full gym with equipment', 30);

-- ============================================
-- Generate booking slots for golf courses
-- Tee times every 10 minutes from 06:00 to 17:50
-- All 7 days of the week, both courses
-- 72 slots/day x 7 days x 2 courses = 1,008 rows
-- ============================================
DO $$
DECLARE
  fid UUID;
  facility_ids UUID[] := ARRAY[
    '00000000-0000-0000-0000-000000000101'::UUID,
    '00000000-0000-0000-0000-000000000102'::UUID
  ];
  dow INT;
  slot_start TIME;
  slot_end TIME;
BEGIN
  FOREACH fid IN ARRAY facility_ids LOOP
    FOR dow IN 0..6 LOOP
      slot_start := '06:00:00'::TIME;
      WHILE slot_start < '18:00:00'::TIME LOOP
        slot_end := slot_start + INTERVAL '10 minutes';
        INSERT INTO booking_slots (facility_id, day_of_week, start_time, end_time, max_bookings, is_active)
        VALUES (fid, dow, slot_start, slot_end, 1, TRUE);
        slot_start := slot_end;
      END LOOP;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- Seed events for demo
-- ============================================
INSERT INTO events (id, club_id, title, description, location, start_date, end_date, capacity, price, status, created_by) VALUES
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001',
   'Spring Golf Tournament',
   'Annual spring tournament open to all golf members. 18-hole stroke play format with prizes for top 3 finishers in each flight. Includes cart, range balls, and awards dinner.',
   'Championship Course',
   '2026-03-15T08:00:00-05:00', '2026-03-15T18:00:00-05:00',
   48, 50.00, 'published',
   (SELECT id FROM members WHERE role = 'admin' AND club_id = '00000000-0000-0000-0000-000000000001' LIMIT 1)),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000001',
   'Wine Tasting Evening',
   'Join us for an evening of fine wines from Napa Valley. Our sommelier will guide you through 6 curated selections paired with artisanal cheeses and charcuterie.',
   'Clubhouse Lounge',
   '2026-03-08T18:30:00-05:00', '2026-03-08T21:00:00-05:00',
   30, 25.00, 'published',
   (SELECT id FROM members WHERE role = 'admin' AND club_id = '00000000-0000-0000-0000-000000000001' LIMIT 1)),
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000001',
   'Family Pool Party',
   'Kick off spring with a family-friendly pool party! BBQ, games, music, and swimming for all ages. Kids activities include face painting and a cannonball contest.',
   'Main Pool & Deck',
   '2026-03-22T11:00:00-05:00', '2026-03-22T16:00:00-05:00',
   100, NULL, 'published',
   (SELECT id FROM members WHERE role = 'admin' AND club_id = '00000000-0000-0000-0000-000000000001' LIMIT 1)),
  ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000001',
   'Easter Brunch',
   'Celebrate Easter with a lavish brunch buffet featuring made-to-order omelettes, carving station, fresh seafood, pastries, and a special kids corner with an egg hunt on the lawn.',
   'Main Dining Room',
   '2026-04-05T10:00:00-05:00', '2026-04-05T14:00:00-05:00',
   60, 35.00, 'published',
   (SELECT id FROM members WHERE role = 'admin' AND club_id = '00000000-0000-0000-0000-000000000001' LIMIT 1));

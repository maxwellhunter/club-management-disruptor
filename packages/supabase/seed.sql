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

-- ============================================
-- Generate booking slots for dining facilities
-- Main Dining Room: dinner 5:00 PM - 9:30 PM, 30-min slots, 10 tables/slot
-- Grill Room: lunch 11:30 AM - 2:00 PM + dinner 5:00 PM - 9:30 PM, 8 tables/slot
-- ============================================
DO $$
DECLARE
  dow INT;
  slot_start TIME;
  slot_end TIME;
BEGIN
  -- Main Dining Room: dinner only
  FOR dow IN 0..6 LOOP
    slot_start := '17:00:00'::TIME;
    WHILE slot_start < '21:30:00'::TIME LOOP
      slot_end := slot_start + INTERVAL '30 minutes';
      INSERT INTO booking_slots (facility_id, day_of_week, start_time, end_time, max_bookings, is_active)
      VALUES ('00000000-0000-0000-0000-000000000103', dow, slot_start, slot_end, 10, TRUE);
      slot_start := slot_end;
    END LOOP;
  END LOOP;

  -- Grill Room: lunch
  FOR dow IN 0..6 LOOP
    slot_start := '11:30:00'::TIME;
    WHILE slot_start < '14:00:00'::TIME LOOP
      slot_end := slot_start + INTERVAL '30 minutes';
      INSERT INTO booking_slots (facility_id, day_of_week, start_time, end_time, max_bookings, is_active)
      VALUES ('00000000-0000-0000-0000-000000000104', dow, slot_start, slot_end, 8, TRUE);
      slot_start := slot_end;
    END LOOP;
  END LOOP;

  -- Grill Room: dinner
  FOR dow IN 0..6 LOOP
    slot_start := '17:00:00'::TIME;
    WHILE slot_start < '21:30:00'::TIME LOOP
      slot_end := slot_start + INTERVAL '30 minutes';
      INSERT INTO booking_slots (facility_id, day_of_week, start_time, end_time, max_bookings, is_active)
      VALUES ('00000000-0000-0000-0000-000000000104', dow, slot_start, slot_end, 8, TRUE);
      slot_start := slot_end;
    END LOOP;
  END LOOP;
END $$;

-- ============================================
-- Menu categories
-- ============================================
INSERT INTO menu_categories (id, club_id, facility_id, name, description, sort_order) VALUES
  -- Main Dining Room
  ('00000000-0000-0000-0000-000000000401', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000103', 'Appetizers', 'Starters and small plates', 1),
  ('00000000-0000-0000-0000-000000000402', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000103', 'Entrees', 'Main courses', 2),
  ('00000000-0000-0000-0000-000000000403', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000103', 'Desserts', 'Sweet endings', 3),
  ('00000000-0000-0000-0000-000000000404', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000103', 'Beverages', 'Wines, cocktails, and soft drinks', 4),
  -- Grill Room
  ('00000000-0000-0000-0000-000000000405', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000104', 'Starters', 'Appetizers and shareable plates', 1),
  ('00000000-0000-0000-0000-000000000406', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000104', 'From the Grill', 'Burgers, steaks, and grilled favorites', 2),
  ('00000000-0000-0000-0000-000000000407', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000104', 'Sandwiches & Salads', 'Lighter fare', 3),
  ('00000000-0000-0000-0000-000000000408', '00000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000104', 'Bar Menu', 'Cocktails, beer, and wine', 4);

-- ============================================
-- Menu items
-- ============================================
INSERT INTO menu_items (club_id, category_id, name, description, price, sort_order) VALUES
  -- Main Dining Room: Appetizers
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000401',
   'Shrimp Cocktail', 'Jumbo shrimp with classic cocktail sauce', 18.00, 1),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000401',
   'Caesar Salad', 'Crisp romaine, parmesan, croutons, house-made dressing', 14.00, 2),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000401',
   'Lobster Bisque', 'Rich and creamy with cognac finish', 16.00, 3),
  -- Main Dining Room: Entrees
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000402',
   'Filet Mignon', '8oz center-cut with truffle butter, seasonal vegetables', 52.00, 1),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000402',
   'Pan-Seared Salmon', 'Atlantic salmon with lemon-dill sauce, wild rice', 38.00, 2),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000402',
   'Roasted Chicken', 'Free-range half chicken, herb jus, mashed potatoes', 32.00, 3),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000402',
   'Grilled Lamb Chops', 'New Zealand rack with rosemary mint sauce', 48.00, 4),
  -- Main Dining Room: Desserts
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000403',
   'Creme Brulee', 'Classic vanilla custard with caramelized sugar', 12.00, 1),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000403',
   'Chocolate Lava Cake', 'Warm center, vanilla bean ice cream', 14.00, 2),
  -- Main Dining Room: Beverages
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000404',
   'Glass of House Red', 'Cabernet Sauvignon, Napa Valley', 15.00, 1),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000404',
   'Glass of House White', 'Chardonnay, Sonoma County', 14.00, 2),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000404',
   'Classic Martini', 'Gin or vodka, dry vermouth, olive', 16.00, 3),
  -- Grill Room: Starters
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000405',
   'Wings', 'Buffalo or BBQ, served with celery and blue cheese', 14.00, 1),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000405',
   'Nachos Supreme', 'Loaded with cheese, jalapenos, sour cream, guacamole', 16.00, 2),
  -- Grill Room: From the Grill
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000406',
   'Club Burger', '8oz angus beef, cheddar, lettuce, tomato, fries', 22.00, 1),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000406',
   'NY Strip Steak', '12oz with loaded baked potato', 42.00, 2),
  -- Grill Room: Sandwiches & Salads
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000407',
   'Club Sandwich', 'Triple-decker with turkey, bacon, avocado', 18.00, 1),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000407',
   'Cobb Salad', 'Grilled chicken, bacon, egg, avocado, blue cheese', 20.00, 2),
  -- Grill Room: Bar Menu
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000408',
   'IPA Draft', 'Local craft IPA, 16oz', 9.00, 1),
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000408',
   'Old Fashioned', 'Bourbon, bitters, orange peel, cherry', 15.00, 2);

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

-- Insert membership tiers
INSERT INTO membership_tiers (club_id, name, level, description, monthly_dues, annual_dues, benefits) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Standard', 'standard', 'Basic club access with dining and pool privileges', 250.00, 2750.00, '["Pool access", "Dining room", "Social events"]'),
  ('00000000-0000-0000-0000-000000000001', 'Golf', 'premium', 'Full golf privileges with cart access', 500.00, 5500.00, '["Unlimited golf", "Cart included", "Pool access", "Dining room", "Pro shop discount"]'),
  ('00000000-0000-0000-0000-000000000001', 'Platinum', 'vip', 'All-access membership with priority booking', 850.00, 9500.00, '["Unlimited golf", "Priority tee times", "Tennis courts", "Pool & fitness", "Private dining", "Guest passes"]'),
  ('00000000-0000-0000-0000-000000000001', 'Legacy', 'honorary', 'Honorary membership for founding members', 0.00, 0.00, '["All club privileges", "Board voting rights", "Reserved parking"]');

-- Insert facilities
INSERT INTO facilities (club_id, name, type, description, capacity) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Championship Course', 'golf', '18-hole championship course', 144),
  ('00000000-0000-0000-0000-000000000001', 'Executive 9', 'golf', '9-hole executive course', 72),
  ('00000000-0000-0000-0000-000000000001', 'Main Dining Room', 'dining', 'Formal dining experience', 80),
  ('00000000-0000-0000-0000-000000000001', 'Grill Room', 'dining', 'Casual dining and bar', 50),
  ('00000000-0000-0000-0000-000000000001', 'Tennis Center', 'tennis', '6 clay courts', 24),
  ('00000000-0000-0000-0000-000000000001', 'Olympic Pool', 'pool', 'Heated Olympic-size pool', 100),
  ('00000000-0000-0000-0000-000000000001', 'Fitness Center', 'fitness', 'Full gym with equipment', 30);

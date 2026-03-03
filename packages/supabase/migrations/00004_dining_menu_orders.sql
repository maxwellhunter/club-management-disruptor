-- ============================================
-- Migration 00004: Dining Menu & Orders
-- Adds menu management and food ordering
-- for dining facilities.
-- ============================================

-- ─── 1. MENU CATEGORIES ────────────────────────────────────────────
CREATE TABLE menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_menu_categories_facility ON menu_categories(facility_id);
CREATE INDEX idx_menu_categories_club ON menu_categories(club_id);

-- ─── 2. MENU ITEMS ─────────────────────────────────────────────────
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  image_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_menu_items_category ON menu_items(category_id);
CREATE INDEX idx_menu_items_club ON menu_items(club_id);

-- ─── 3. DINING ORDERS ──────────────────────────────────────────────
CREATE TABLE dining_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled')),
  table_number TEXT,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dining_orders_club_member ON dining_orders(club_id, member_id);
CREATE INDEX idx_dining_orders_status ON dining_orders(club_id, status);
CREATE INDEX idx_dining_orders_booking ON dining_orders(booking_id);
CREATE INDEX idx_dining_orders_facility ON dining_orders(facility_id);

-- ─── 4. DINING ORDER ITEMS ─────────────────────────────────────────
CREATE TABLE dining_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES dining_orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  special_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dining_order_items_order ON dining_order_items(order_id);

-- ─── 5. RLS POLICIES ───────────────────────────────────────────────

ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_order_items ENABLE ROW LEVEL SECURITY;

-- Menu categories: all club members can read, admins can write
CREATE POLICY "Members can view menu categories"
  ON menu_categories FOR SELECT
  USING (club_id = get_member_club_id());

CREATE POLICY "Admins can insert menu categories"
  ON menu_categories FOR INSERT
  WITH CHECK (club_id = get_member_club_id() AND is_club_admin());

CREATE POLICY "Admins can update menu categories"
  ON menu_categories FOR UPDATE
  USING (club_id = get_member_club_id() AND is_club_admin());

CREATE POLICY "Admins can delete menu categories"
  ON menu_categories FOR DELETE
  USING (club_id = get_member_club_id() AND is_club_admin());

-- Menu items: all club members can read, admins can write
CREATE POLICY "Members can view menu items"
  ON menu_items FOR SELECT
  USING (club_id = get_member_club_id());

CREATE POLICY "Admins can insert menu items"
  ON menu_items FOR INSERT
  WITH CHECK (club_id = get_member_club_id() AND is_club_admin());

CREATE POLICY "Admins can update menu items"
  ON menu_items FOR UPDATE
  USING (club_id = get_member_club_id() AND is_club_admin());

CREATE POLICY "Admins can delete menu items"
  ON menu_items FOR DELETE
  USING (club_id = get_member_club_id() AND is_club_admin());

-- Dining orders: members see own, admins see all club orders
CREATE POLICY "Members can view own dining orders"
  ON dining_orders FOR SELECT
  USING (
    club_id = get_member_club_id()
    AND (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()) OR is_club_admin())
  );

CREATE POLICY "Members can create dining orders"
  ON dining_orders FOR INSERT
  WITH CHECK (club_id = get_member_club_id());

CREATE POLICY "Members can update own dining orders"
  ON dining_orders FOR UPDATE
  USING (
    club_id = get_member_club_id()
    AND (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()) OR is_club_admin())
  );

-- Dining order items: visible if the parent order is visible
CREATE POLICY "Members can view own order items"
  ON dining_order_items FOR SELECT
  USING (order_id IN (
    SELECT id FROM dining_orders
    WHERE club_id = get_member_club_id()
    AND (member_id IN (SELECT id FROM members WHERE user_id = auth.uid()) OR is_club_admin())
  ));

CREATE POLICY "Members can create order items"
  ON dining_order_items FOR INSERT
  WITH CHECK (order_id IN (
    SELECT id FROM dining_orders
    WHERE club_id = get_member_club_id()
  ));

-- ─── 6. TRIGGERS ───────────────────────────────────────────────────

CREATE TRIGGER set_updated_at BEFORE UPDATE ON menu_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON dining_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

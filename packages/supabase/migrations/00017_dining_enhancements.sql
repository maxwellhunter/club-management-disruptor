-- ============================================
-- Migration 00017: Dining Enhancements
-- Adds dietary tags, prep time estimates,
-- and table inventory to dining features.
-- ============================================

-- ─── 1. MENU ITEM DIETARY TAGS ────────────────────────────────────
-- Array of tags like 'vegetarian', 'vegan', 'gluten-free', 'nut-free', 'dairy-free', 'spicy'
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS dietary_tags TEXT[] DEFAULT '{}';

-- ─── 2. ORDER PREP TIME ESTIMATE ──────────────────────────────────
-- Set by admin when confirming/preparing an order
ALTER TABLE dining_orders ADD COLUMN IF NOT EXISTS estimated_prep_minutes INTEGER;

-- ─── 3. FACILITY TABLE INVENTORY ──────────────────────────────────
-- JSONB array of table definitions: [{"number": "1", "seats": 4, "location": "main"}, ...]
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS tables JSONB DEFAULT '[]';

-- ─── 4. INDEX FOR DIETARY TAG QUERIES ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_menu_items_dietary_tags ON menu_items USING GIN(dietary_tags);

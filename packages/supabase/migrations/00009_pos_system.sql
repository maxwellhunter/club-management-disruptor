-- ============================================
-- 00009: POS System Tables
-- Point-of-sale configuration and transactions
-- ============================================

-- POS provider config per location
CREATE TABLE pos_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('stripe_terminal', 'square', 'toast', 'lightspeed', 'manual')),
    location TEXT NOT NULL CHECK (location IN ('dining', 'pro_shop', 'bar', 'snack_bar', 'other')),
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    config JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- POS transactions (sales, refunds, voids)
CREATE TABLE pos_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    pos_config_id UUID NOT NULL REFERENCES pos_configs(id) ON DELETE RESTRICT,
    member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    external_id TEXT, -- ID from external POS provider (Stripe PI, Square payment, etc.)
    type TEXT NOT NULL DEFAULT 'sale' CHECK (type IN ('sale', 'refund', 'void')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded', 'voided', 'failed')),
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
    tax NUMERIC(10,2) NOT NULL DEFAULT 0,
    tip NUMERIC(10,2) NOT NULL DEFAULT 0,
    total NUMERIC(10,2) NOT NULL DEFAULT 0,
    payment_method TEXT, -- card, cash, member_charge, etc.
    location TEXT NOT NULL CHECK (location IN ('dining', 'pro_shop', 'bar', 'snack_bar', 'other')),
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- POS transaction line items
CREATE TABLE pos_transaction_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES pos_transactions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    total NUMERIC(10,2) NOT NULL DEFAULT 0,
    category TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_pos_configs_club ON pos_configs(club_id);
CREATE INDEX idx_pos_transactions_club ON pos_transactions(club_id);
CREATE INDEX idx_pos_transactions_member ON pos_transactions(member_id);
CREATE INDEX idx_pos_transactions_config ON pos_transactions(pos_config_id);
CREATE INDEX idx_pos_transactions_date ON pos_transactions(created_at DESC);
CREATE INDEX idx_pos_transactions_status ON pos_transactions(club_id, status);
CREATE INDEX idx_pos_transaction_items_txn ON pos_transaction_items(transaction_id);

-- Auto-update updated_at
CREATE TRIGGER pos_configs_updated_at
    BEFORE UPDATE ON pos_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER pos_transactions_updated_at
    BEFORE UPDATE ON pos_transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE pos_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_transaction_items ENABLE ROW LEVEL SECURITY;

-- POS configs: admins and staff can read; admins can write
CREATE POLICY pos_configs_read ON pos_configs
    FOR SELECT USING (club_id = get_member_club_id());

CREATE POLICY pos_configs_admin ON pos_configs
    FOR ALL USING (is_club_admin());

-- POS transactions: admins and staff can read/write; members see own
CREATE POLICY pos_transactions_read ON pos_transactions
    FOR SELECT USING (
        club_id = get_member_club_id()
        AND (
            is_club_admin()
            OR member_id = (SELECT id FROM members WHERE user_id = auth.uid() LIMIT 1)
        )
    );

CREATE POLICY pos_transactions_staff ON pos_transactions
    FOR INSERT WITH CHECK (club_id = get_member_club_id());

CREATE POLICY pos_transactions_admin ON pos_transactions
    FOR UPDATE USING (is_club_admin());

-- Transaction items: readable if parent transaction is readable
CREATE POLICY pos_transaction_items_read ON pos_transaction_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM pos_transactions
            WHERE pos_transactions.id = pos_transaction_items.transaction_id
            AND pos_transactions.club_id = get_member_club_id()
        )
    );

CREATE POLICY pos_transaction_items_insert ON pos_transaction_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM pos_transactions
            WHERE pos_transactions.id = pos_transaction_items.transaction_id
            AND pos_transactions.club_id = get_member_club_id()
        )
    );

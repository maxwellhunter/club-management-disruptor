-- ============================================
-- 00010: Accounting & GL Export Tables
-- Chart of accounts, GL mappings, journal entries, export batches
-- ============================================

-- Chart of Accounts
CREATE TABLE gl_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    account_number TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('revenue', 'expense', 'asset', 'liability', 'equity')),
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(club_id, account_number)
);

-- GL Mappings: map ClubOS revenue categories to GL accounts
CREATE TABLE gl_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    source_category TEXT NOT NULL, -- e.g., 'membership_dues', 'dining_revenue', 'pro_shop_revenue'
    gl_account_id UUID NOT NULL REFERENCES gl_accounts(id) ON DELETE CASCADE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(club_id, source_category)
);

-- Export Batches: track each GL export run
CREATE TABLE export_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    format TEXT NOT NULL CHECK (format IN ('iif', 'qbo', 'csv')),
    provider TEXT NOT NULL CHECK (provider IN ('quickbooks', 'sage', 'xero', 'csv')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    entry_count INTEGER NOT NULL DEFAULT 0,
    total_debits NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_credits NUMERIC(12,2) NOT NULL DEFAULT 0,
    file_url TEXT, -- URL or path to generated export file
    error_message TEXT,
    exported_by UUID NOT NULL REFERENCES members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Journal Entries: individual debit/credit entries in each export
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
    export_batch_id UUID REFERENCES export_batches(id) ON DELETE SET NULL,
    source TEXT NOT NULL CHECK (source IN ('invoice', 'payment', 'pos_transaction', 'refund')),
    source_id UUID NOT NULL, -- FK to invoices, payments, or pos_transactions
    date DATE NOT NULL,
    description TEXT NOT NULL,
    debit_account_id UUID NOT NULL REFERENCES gl_accounts(id),
    credit_account_id UUID NOT NULL REFERENCES gl_accounts(id),
    amount NUMERIC(12,2) NOT NULL,
    member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    reference TEXT, -- invoice number, payment ref, etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_gl_accounts_club ON gl_accounts(club_id);
CREATE INDEX idx_gl_mappings_club ON gl_mappings(club_id);
CREATE INDEX idx_export_batches_club ON export_batches(club_id, created_at DESC);
CREATE INDEX idx_journal_entries_club ON journal_entries(club_id);
CREATE INDEX idx_journal_entries_batch ON journal_entries(export_batch_id);
CREATE INDEX idx_journal_entries_source ON journal_entries(source, source_id);
CREATE INDEX idx_journal_entries_date ON journal_entries(club_id, date);

-- RLS
ALTER TABLE gl_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

-- Admin-only access for all accounting tables
CREATE POLICY gl_accounts_admin ON gl_accounts
    FOR ALL USING (is_club_admin());

CREATE POLICY gl_mappings_admin ON gl_mappings
    FOR ALL USING (is_club_admin());

CREATE POLICY export_batches_admin ON export_batches
    FOR ALL USING (is_club_admin());

CREATE POLICY journal_entries_admin ON journal_entries
    FOR ALL USING (is_club_admin());

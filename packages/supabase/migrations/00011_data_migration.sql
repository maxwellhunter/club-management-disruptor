-- ============================================
-- Data Migration / Import System
-- Track CSV imports from Jonas, Northstar, etc.
-- ============================================

CREATE TABLE import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  source_system TEXT NOT NULL CHECK (source_system IN ('jonas', 'northstar', 'clubessential', 'generic_csv')),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('members', 'invoices', 'payments', 'bookings', 'events')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'validating', 'preview', 'importing', 'completed', 'failed', 'cancelled')),
  file_name TEXT NOT NULL,
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  error_rows INTEGER NOT NULL DEFAULT 0,
  imported_rows INTEGER NOT NULL DEFAULT 0,
  skipped_rows INTEGER NOT NULL DEFAULT 0,
  field_mapping JSONB NOT NULL DEFAULT '{}',
  errors JSONB NOT NULL DEFAULT '[]',
  imported_by UUID NOT NULL REFERENCES members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- RLS: Admin-only access
ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage import batches"
  ON import_batches FOR ALL
  USING (
    club_id = get_member_club_id()
    AND is_club_admin()
  )
  WITH CHECK (
    club_id = get_member_club_id()
    AND is_club_admin()
  );

-- Index for listing imports by club
CREATE INDEX idx_import_batches_club ON import_batches(club_id, created_at DESC);

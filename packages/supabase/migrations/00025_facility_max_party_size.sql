-- Add max_party_size to facilities for per-venue party size limits
ALTER TABLE facilities ADD COLUMN IF NOT EXISTS max_party_size INTEGER DEFAULT 12;

-- Set sensible defaults for dining venues
UPDATE facilities SET max_party_size = 10 WHERE type = 'dining';
UPDATE facilities SET max_party_size = 4 WHERE type = 'golf';

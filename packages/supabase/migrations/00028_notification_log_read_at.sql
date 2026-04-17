-- Add `read_at` to `notification_log` so members can see their own
-- notification history with unread-state tracking. Previously the table
-- only stored delivery state (sent/failed/skipped) for admin analytics;
-- the new column lets us power a member-facing inbox and bell badge
-- without a separate `notification_reads` table.

BEGIN;

ALTER TABLE notification_log
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ NULL;

-- Index the unread-per-member lookup. The most common query the Home
-- screen will run is "how many unread for this member?" — this covers it.
CREATE INDEX IF NOT EXISTS idx_notification_log_member_unread
  ON notification_log (member_id)
  WHERE read_at IS NULL;

COMMIT;

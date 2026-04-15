-- Remove the "maybe" RSVP status. Product decision: members either commit
-- (Going) or pass (Can't Go) — "Maybe" isn't actionable for headcount
-- planning and was confusing members and staff alike.
--
-- Steps:
--   1. Rewrite any existing 'maybe' rows to 'declined' so they no longer
--      count against capacity or appear in the attending list.
--   2. Drop the old CHECK constraint and re-add it without 'maybe'.

BEGIN;

-- 1. Collapse existing 'maybe' RSVPs into 'declined'.
UPDATE event_rsvps
SET status = 'declined'
WHERE status = 'maybe';

-- 2. Swap the CHECK constraint.
ALTER TABLE event_rsvps
  DROP CONSTRAINT IF EXISTS event_rsvps_status_check;

ALTER TABLE event_rsvps
  ADD CONSTRAINT event_rsvps_status_check
  CHECK (status IN ('attending', 'declined', 'waitlisted'));

COMMIT;

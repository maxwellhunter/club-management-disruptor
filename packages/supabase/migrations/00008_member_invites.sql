-- ============================================
-- Member Invite System
-- Admin-creates-then-member-claims flow
-- ============================================

-- Add 'invited' to member status check constraint
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_status_check;
ALTER TABLE members ADD CONSTRAINT members_status_check
  CHECK (status IN ('active', 'inactive', 'suspended', 'pending', 'invited'));

-- Add invite columns to members
ALTER TABLE members ADD COLUMN IF NOT EXISTS invite_token UUID DEFAULT gen_random_uuid();
ALTER TABLE members ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;
ALTER TABLE members ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMPTZ;
ALTER TABLE members ADD COLUMN IF NOT EXISTS invite_accepted_at TIMESTAMPTZ;

-- Unique index on invite_token (only for non-null, non-expired invites)
CREATE UNIQUE INDEX IF NOT EXISTS idx_members_invite_token
  ON members(invite_token)
  WHERE invite_token IS NOT NULL;

-- RLS: Allow unauthenticated users to read a member by invite_token
-- (needed for the /invite/[token] page to load club info)
CREATE POLICY "Anyone can view invited member by token"
  ON members FOR SELECT
  USING (
    status = 'invited'
    AND invite_token IS NOT NULL
    AND invite_expires_at > NOW()
  );

-- Allow unauthenticated users to view the club for a valid invite
CREATE POLICY "Anyone can view club for valid invite"
  ON clubs FOR SELECT
  USING (
    id IN (
      SELECT club_id FROM members
      WHERE status = 'invited'
        AND invite_token IS NOT NULL
        AND invite_expires_at > NOW()
    )
  );

-- Allow unauthenticated to view tiers for valid invite (to show tier name on invite page)
CREATE POLICY "Anyone can view tiers for valid invite"
  ON membership_tiers FOR SELECT
  USING (
    club_id IN (
      SELECT club_id FROM members
      WHERE status = 'invited'
        AND invite_token IS NOT NULL
        AND invite_expires_at > NOW()
    )
  );

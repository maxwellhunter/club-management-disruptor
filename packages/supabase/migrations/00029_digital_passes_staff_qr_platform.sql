-- Allow "staff_qr" as a digital_passes.platform value so admins can
-- provision scannable QR codes for members who haven't added a real
-- Apple/Google Wallet pass yet. Previously the CHECK constraint
-- rejected anything but 'apple'/'google', which silently blocked the
-- bulk-provisioning done by /api/admin/member-qrcodes and left the
-- scanner returning 404 on any staff-provisioned QR.

BEGIN;

ALTER TABLE digital_passes
  DROP CONSTRAINT IF EXISTS digital_passes_platform_check;

ALTER TABLE digital_passes
  ADD CONSTRAINT digital_passes_platform_check
  CHECK (platform = ANY (ARRAY['apple'::text, 'google'::text, 'staff_qr'::text]));

COMMIT;

-- Where each QR referral was scanned. All nullable: GPS is optional (the customer can deny the browser's
-- location prompt) and these are additive, so existing referrals keep working.
ALTER TABLE "referrals"
  ADD COLUMN "scan_lat" DOUBLE PRECISION,
  ADD COLUMN "scan_lng" DOUBLE PRECISION,
  ADD COLUMN "scan_accuracy_m" INTEGER,
  ADD COLUMN "scan_address" TEXT,
  ADD COLUMN "scan_place_label" TEXT;

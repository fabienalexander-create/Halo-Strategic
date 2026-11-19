-- Tags every homeowner SMS request with what it is for (additive only; no existing row changes
-- meaning, nothing is backfilled beyond the column default).
--
-- PHONE_VERIFICATION: the original "Reply YES <ref>" verification for Solar & Battery website
--   enquiries (lib/smsVerification.ts queueVerification). Every existing row is this, so it is the
--   default and existing behaviour is untouched.
-- META_FOLLOW_UP: a one-way text to a Meta Instant Form homeowner with their single-use link to
--   finish the enquiry on the website (lib/smsVerification.ts queueMetaFollowUp). A YES reply must
--   never verify one of these (Fabien, 2026-11-19): handleInboundReply only ever matches
--   PHONE_VERIFICATION rows. STOP still closes requests of every purpose.
--
-- Same table on purpose, so a follow-up and a verification share one suppression list, one set of
-- per-number and hourly caps, one sender, one delivery-receipt route and one audit trail.
--
-- Rollback (run only with approval, app rolled back first):
--   ALTER TABLE lead_phone_verifications DROP COLUMN IF EXISTS purpose;

ALTER TABLE lead_phone_verifications
  ADD COLUMN purpose TEXT NOT NULL DEFAULT 'PHONE_VERIFICATION'
  CHECK (purpose IN ('PHONE_VERIFICATION', 'META_FOLLOW_UP'));

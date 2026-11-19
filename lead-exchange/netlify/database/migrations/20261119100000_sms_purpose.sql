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
-- follow_up_token_enc: the follow-up link token for one META_FOLLOW_UP text, encrypted at rest
--   (AES-256-GCM, key SMS_LINK_ENCRYPTION_KEY, bound to this row's id; see lib/smsLinkCrypto.ts).
--   Minted on the first send attempt and reused by every retry, so a text that reached the
--   homeowner even though its confirmation timed out keeps a working link (Fabien, 2026-11-19:
--   "one stable link per queued message, reused across all three delivery attempts"). Wiped as
--   soon as the text no longer needs sending (sent, failed, expired, stopped or superseded). Only
--   ever set on META_FOLLOW_UP rows. leads.follow_up_token_hash still holds only the hash.
--
-- Rollback (run only with approval, app rolled back first):
--   ALTER TABLE lead_phone_verifications DROP COLUMN IF EXISTS follow_up_token_enc;
--   ALTER TABLE lead_phone_verifications DROP COLUMN IF EXISTS purpose;

ALTER TABLE lead_phone_verifications
  ADD COLUMN purpose TEXT NOT NULL DEFAULT 'PHONE_VERIFICATION'
  CHECK (purpose IN ('PHONE_VERIFICATION', 'META_FOLLOW_UP'));

ALTER TABLE lead_phone_verifications
  ADD COLUMN follow_up_token_enc TEXT
  CHECK (follow_up_token_enc IS NULL OR purpose = 'META_FOLLOW_UP');

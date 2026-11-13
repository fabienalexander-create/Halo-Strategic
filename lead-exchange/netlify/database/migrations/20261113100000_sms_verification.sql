-- Homeowner phone verification by SMS (additive only; nothing is backfilled, no existing row changes).
--
-- lead_phone_verifications: one row per verification request, each with its own short reference.
--   At most one OPEN request per lead (partial unique index). Verification is read from this table;
--   leads.status is not touched. Only a matched YES reply sets VERIFIED; delivery receipts never do.
-- sms_suppressions: numbers that must never be texted (STOP, manual, invalid). Checked in Halo when
--   a request is queued and again when the sender claims it.
-- Separate from homeowner_confirmations, which is buyer release confirmation.
--
-- Rollback (run only with approval, app rolled back first):
--   DROP TABLE IF EXISTS lead_phone_verifications;
--   DROP TABLE IF EXISTS sms_suppressions;

CREATE TABLE sms_suppressions (
  id SERIAL PRIMARY KEY,
  phone_e164 TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL CHECK (reason IN ('STOP', 'MANUAL', 'INVALID')),
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE lead_phone_verifications (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id),
  verification_ref TEXT NOT NULL UNIQUE,
  phone_e164 TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING_SEND' CHECK (status IN (
    'PENDING_SEND', 'SENDING', 'SENT', 'DELIVERED', 'VERIFIED',
    'EXPIRED', 'FAILED', 'FAILED_INVALID_NUMBER', 'SUPPRESSED', 'SUPERSEDED'
  )),
  expires_at TIMESTAMPTZ NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  inbound_message_id TEXT UNIQUE,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status = 'FAILED_INVALID_NUMBER' OR phone_e164 IS NOT NULL)
);

-- One open request per lead, enforced by the database.
CREATE UNIQUE INDEX uq_lead_phone_verifications_open_per_lead
  ON lead_phone_verifications (lead_id)
  WHERE status IN ('PENDING_SEND', 'SENDING', 'SENT', 'DELIVERED');

CREATE INDEX idx_lead_phone_verifications_phone_status ON lead_phone_verifications (phone_e164, status);
CREATE INDEX idx_lead_phone_verifications_provider_msg ON lead_phone_verifications (provider_message_id);
CREATE INDEX idx_lead_phone_verifications_created ON lead_phone_verifications (created_at);

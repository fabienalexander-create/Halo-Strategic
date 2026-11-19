-- Outbox for non-verification homeowner SMS. Stage 1 has one purpose: the Meta follow-up text
-- that sends a QUALIFICATION_PENDING homeowner their website completion link
-- (lib/metaFollowUpSms.ts). Kept separate from lead_phone_verifications, which models the
-- solar YES-reply verification flow and its own statuses.
--
-- No working link is ever stored here. link_nonce is the input to
-- HMAC-SHA256(META_FOLLOW_UP_LINK_KEY, nonce); the key lives only in the environment, so this
-- table alone cannot reproduce a link. The nonce exists only while a message can still be sent
-- (PENDING_SEND / SENDING) and is wiped in every other state -- enforced by the CHECK below, not
-- just by application code.
--
-- Additive only. No existing table, column, row or index is changed.
-- Rollback (app rolled back first): DROP TABLE lead_sms_messages;

CREATE TABLE lead_sms_messages (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id),
  purpose TEXT NOT NULL CHECK (purpose IN ('META_FOLLOW_UP')),
  message_ref TEXT NOT NULL UNIQUE,
  phone_e164 TEXT NOT NULL,
  link_nonce TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING_SEND' CHECK (status IN (
    'PENDING_SEND', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'SUPPRESSED', 'CANCELLED', 'BLOCKED_TEST_MODE'
  )),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  error_message TEXT,
  created_by TEXT NOT NULL,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((status IN ('PENDING_SEND', 'SENDING')) = (link_nonce IS NOT NULL))
);

-- At most one sendable message per lead and purpose: a retried intake or a double-clicked reissue
-- can never queue two texts for the same lead.
CREATE UNIQUE INDEX uq_lead_sms_messages_open ON lead_sms_messages (lead_id, purpose)
  WHERE status IN ('PENDING_SEND', 'SENDING');

CREATE UNIQUE INDEX uq_lead_sms_messages_provider_id ON lead_sms_messages (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX idx_lead_sms_messages_phone_created ON lead_sms_messages (phone_e164, created_at);

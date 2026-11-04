-- Outbox for the two automated buyer-application emails (application received, application
-- approved for commercial review). A row is written here in the SAME transaction/step as the
-- business event it represents, before any attempt to actually send -- so "the application was
-- saved but the outbox row never got created" can't happen, and a later retry never needs to
-- repeat the original application or approval action.
--
-- The (buyer_id, email_type) unique index IS the idempotency key: creating the outbox entry is
-- an INSERT ... ON CONFLICT DO NOTHING, so the event exists exactly once no matter how many times
-- the triggering request is retried. The row's own serial id is this event's unique identifier,
-- used everywhere a specific send/retry attempt needs to reference it.
--
-- PENDING: outbox row created, not yet attempted (or attempted and the process died before an
--   outcome could be recorded -- safe starting state for a retry).
-- SENT: the provider accepted the message. Not the same as delivered.
-- FAILED: the provider rejected it, or the send attempt threw. Retryable.
-- DELIVERED: the provider's webhook confirmed delivery to the recipient's mail server, where the
--   provider supports delivery webhooks. Only ever reached via SENT.
CREATE TABLE transactional_emails (
  id SERIAL PRIMARY KEY,
  buyer_id INTEGER NOT NULL REFERENCES buyers(id),
  email_type TEXT NOT NULL CHECK (email_type IN (
    'APPLICATION_RECEIVED',
    'APPLICATION_APPROVED_FOR_COMMERCIAL_REVIEW'
  )),
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'DELIVERED')),
  provider_message_id TEXT,
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_transactional_emails_buyer_type_unique ON transactional_emails(buyer_id, email_type);
CREATE INDEX idx_transactional_emails_status ON transactional_emails(status);
CREATE INDEX idx_transactional_emails_provider_message_id ON transactional_emails(provider_message_id);

-- Delivery log for the two automated buyer-application emails (application received,
-- application approved for commercial review). Every send attempt is recorded, successful
-- or not, so a failed send is visible without digging through function logs, and so a
-- second attempt for the same buyer + email type can be detected and skipped.
CREATE TABLE transactional_emails (
  id SERIAL PRIMARY KEY,
  buyer_id INTEGER NOT NULL REFERENCES buyers(id),
  email_type TEXT NOT NULL CHECK (email_type IN (
    'APPLICATION_RECEIVED',
    'APPLICATION_APPROVED_FOR_COMMERCIAL_REVIEW'
  )),
  recipient TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SENT', 'FAILED')),
  provider_message_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactional_emails_buyer_type ON transactional_emails(buyer_id, email_type);

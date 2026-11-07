-- Outbox for mirroring homeowner leads into the operational Google Sheet ("Halo Lead Delivery
-- System v1"), same pattern as transactional_emails: a row is created in the SAME transaction as
-- the lead insert, so "the lead saved but the sync was never recorded" can't happen. lead_id is
-- UNIQUE -- this IS the idempotency key, same role (buyer_id, email_type) plays for emails.
-- The database stays the source of truth; this table only tracks whether the mirror is caught up.
CREATE TABLE lead_sheet_syncs (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL UNIQUE REFERENCES leads(id),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SYNCED', 'FAILED')),
  sheet_row_number INTEGER,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_sheet_syncs_status ON lead_sheet_syncs(status);

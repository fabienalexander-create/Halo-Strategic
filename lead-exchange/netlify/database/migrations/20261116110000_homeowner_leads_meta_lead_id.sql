-- Supports automatic homeowner-lead ingestion from Meta Lead Ads (via Make). Additive only.
--
-- meta_lead_id is the idempotency key: a partial unique index (not a plain UNIQUE column, since
-- most existing and future rows -- anything entered manually, or from a non-Meta source -- have
-- no Meta lead id at all and must not be forced to collide on NULL=NULL, which Postgres treats as
-- distinct anyway, but this makes the intent explicit). The ingestion endpoint relies on this
-- index via INSERT ... ON CONFLICT (meta_lead_id) DO NOTHING -- a retried delivery of the same
-- Meta lead can never create a second row.
ALTER TABLE leads ADD COLUMN meta_lead_id TEXT;
CREATE UNIQUE INDEX uq_leads_meta_lead_id ON leads(meta_lead_id) WHERE meta_lead_id IS NOT NULL;

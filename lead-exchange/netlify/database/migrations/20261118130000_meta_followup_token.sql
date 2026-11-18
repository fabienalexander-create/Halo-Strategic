-- Supports the website follow-up journey for homeowners who arrive via the Meta Instant Form,
-- which today asks only five questions (owns_property, email, full_name, phone_number,
-- post_code) and has no consent question at all. A Meta-sourced lead that is missing the
-- qualification questions (reason, timeframe, preferred contact method) or explicit consent is
-- still saved -- as an incomplete, QUALIFICATION_PENDING lead, flagged via the existing
-- needs_manual_review mechanism -- rather than rejected outright. This token is how that same
-- homeowner can later finish the enquiry on the website, in one visit, without Halo contacting
-- them first and without inventing consent on their behalf.
--
-- Additive only. No existing column, table, row or index is changed.
--
-- follow_up_token_hash stores a SHA-256 hash of the actual token, never the raw value -- the same
-- discipline as password storage. The raw, cryptographically random token exists only in the
-- URL given to the homeowner (returned once, in the ingestion endpoint's own response) and
-- briefly in the request to the completion endpoint; it is never written to this database. A
-- partial unique index, not a plain UNIQUE column, since most leads (website-sourced, manually
-- entered, or a Meta lead that already had everything) have no token at all.
ALTER TABLE leads ADD COLUMN follow_up_token_hash TEXT;

-- Time-limited: a token is only valid until this timestamp. Set at issuance, never extended.
ALTER TABLE leads ADD COLUMN follow_up_token_expires_at TIMESTAMPTZ;

-- Single-use: set the moment a completion submission successfully claims the token (see
-- app/api/homeowner-enquiries/complete/route.ts, which claims it with one atomic
-- UPDATE ... WHERE follow_up_token_used_at IS NULL, so two concurrent submissions of the same
-- token can never both succeed). NULL means unused.
ALTER TABLE leads ADD COLUMN follow_up_token_used_at TIMESTAMPTZ;

CREATE UNIQUE INDEX uq_leads_follow_up_token_hash ON leads(follow_up_token_hash) WHERE follow_up_token_hash IS NOT NULL;

-- Buyer prospect capture (short interest-capture stage, ahead of the full buyer application).
--
-- Deliberately a separate table from buyers, never a draft/pending buyers row: a prospect record
-- can never, by itself, grant lead inventory access, create an approved buyer, or submit a full
-- application. Converting is tracked by linking to a real buyers row once one exists
-- (converted_buyer_id), not by promoting this row in place.
--
-- Additive only, same discipline as every migration so far: no existing table touched.

CREATE TABLE buyer_prospects (
  id SERIAL PRIMARY KEY,
  prospect_reference TEXT NOT NULL UNIQUE,                  -- shown to admin only, e.g. HLX-PROSPECT-000001
  industry_id INTEGER NOT NULL REFERENCES industries(id),

  company_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  telephone TEXT NOT NULL,
  postcodes_covered TEXT,                                   -- free text at this stage; the full
                                                             -- structured postcode/county list is
                                                             -- a full-application field, not this one
  approx_monthly_lead_requirement TEXT,

  -- Best-effort source attribution, not a guaranteed-accurate analytics pipeline: derived
  -- server-side from UTM parameters and referrer, consistent with the honesty standard applied
  -- everywhere else (never presented as more precise than it is).
  source TEXT NOT NULL DEFAULT 'organic_website'
    CHECK (source IN ('meta', 'instantly', 'organic_website', 'direct_referral', 'other')),
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,

  -- Two separate consents, same "never bundled" discipline as every homeowner/buyer form in this
  -- app: being contacted about this enquiry is required; marketing is optional and separately
  -- recorded, never implied by the first.
  consent_contact BOOLEAN NOT NULL,
  marketing_consent BOOLEAN NOT NULL DEFAULT false,
  consent_recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  nurture_status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (nurture_status IN ('ACTIVE', 'PAUSED', 'CONVERTED', 'UNSUBSCRIBED', 'EXITED_NO_RESPONSE')),
  nurture_step INTEGER NOT NULL DEFAULT 0,
  last_nurture_sent_at TIMESTAMPTZ,

  -- Set once this prospect submits the full buyer application (matched by contact_email) --
  -- a link to real history, never a promotion of this row into a buyers row.
  converted_buyer_id INTEGER REFERENCES buyers(id),
  converted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_buyer_prospects_nurture ON buyer_prospects(nurture_status, last_nurture_sent_at);
CREATE INDEX idx_buyer_prospects_email ON buyer_prospects(contact_email);

-- Nurture send log -- same idempotent-outbox shape as transactional_emails and
-- lead_delivery_emails, scoped per (prospect, step) so a retried send within the same step can
-- never double-send, and a step can never be skipped silently.
CREATE TABLE buyer_prospect_emails (
  id SERIAL PRIMARY KEY,
  prospect_id INTEGER NOT NULL REFERENCES buyer_prospects(id),
  nurture_step INTEGER NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'DELIVERED')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (prospect_id, nurture_step)
);
CREATE INDEX idx_buyer_prospect_emails_status ON buyer_prospect_emails(status);

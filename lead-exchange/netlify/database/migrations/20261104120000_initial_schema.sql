-- Halo Lead Exchange — initial schema
-- Matches the entity model in docs/halo_lead_exchange_phase1_architecture_proposal.md (§3),
-- extended with buyer-onboarding, suitability-questionnaire, and 24-hour allocation fields.

CREATE TABLE industries (
  id SERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,                 -- e.g. 'spray_foam_removal'
  name TEXT NOT NULL,
  -- Per-industry config for the allocation engine (§13 of the Phase 1 addendum):
  -- how many exclusive 24h windows a lead gets before falling into shared inventory,
  -- and how long each exclusive window lasts, in hours.
  exclusive_allocation_attempts INTEGER NOT NULL DEFAULT 2,
  exclusive_window_hours INTEGER NOT NULL DEFAULT 24,
  replacement_contact_window_days INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO industries (slug, name) VALUES ('spray_foam_removal', 'Spray Foam Removal');

CREATE TABLE buyers (
  id SERIAL PRIMARY KEY,
  -- Identity / business profile
  company_name TEXT NOT NULL,
  website TEXT,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  telephone TEXT NOT NULL,
  company_registration_number TEXT,
  years_operating TEXT,
  business_location TEXT,

  -- Industry + capability
  industry_id INTEGER NOT NULL REFERENCES industries(id),
  services_offered JSONB NOT NULL DEFAULT '[]',          -- e.g. ["open_cell_removal","closed_cell_removal"]
  does_own_fulfilment BOOLEAN,                            -- false = subcontracts
  has_required_insurance_and_quals BOOLEAN,

  -- Geographic coverage
  counties_covered JSONB NOT NULL DEFAULT '[]',
  postcodes_covered JSONB NOT NULL DEFAULT '[]',
  coverage_type TEXT,                                     -- 'national' | 'regional'
  excluded_areas TEXT,
  max_travel_distance_miles INTEGER,

  -- Lead requirements / commercial preferences (also the suitability-score inputs)
  weekly_lead_capacity INTEGER,
  preferred_monthly_volume INTEGER,
  volume_preference TEXT,                                 -- 'steady_flow' | 'occasional'
  accepts_long_term_prospects BOOLEAN,
  property_types_accepted JSONB NOT NULL DEFAULT '[]',
  min_project_value NUMERIC,
  max_project_value NUMERIC,
  exclusivity_preference TEXT,                             -- 'exclusive' | 'shared' | 'either'
  preferred_price_range_low NUMERIC,
  preferred_price_range_high NUMERIC,
  purchase_model_preference TEXT,                          -- 'per_lead' | 'agreed_weekly_volume'

  -- Existing lead-buying experience
  has_bought_leads_before BOOLEAN,
  previous_lead_providers TEXT,
  previous_leads_exclusive_or_shared TEXT,
  previous_price_paid_per_lead NUMERIC,
  previous_leads_worthwhile_pct INTEGER,
  previous_supplier_problems TEXT,
  reliability_criteria TEXT,

  -- Sales process and capacity (feeds the suitability score)
  who_handles_enquiries TEXT,
  has_dedicated_sales_team BOOLEAN,
  can_contact_during_business_hours BOOLEAN,
  typical_first_response_time TEXT,
  surveys_per_week_capacity INTEGER,
  typical_qualified_to_job_conversion_pct INTEGER,
  avg_revenue_per_completed_job NUMERIC,                   -- one of the 3 "especially want" questions

  -- Terms / consent (logged checkbox, not DocuSign — per 2026-11-04 decision)
  confirmed_info_accurate BOOLEAN NOT NULL DEFAULT false,
  confirmed_can_deliver_services BOOLEAN NOT NULL DEFAULT false,
  agreed_buyer_terms_at TIMESTAMPTZ,
  agreed_buyer_terms_version TEXT,
  acknowledged_replacement_policy_at TIMESTAMPTZ,
  acknowledged_replacement_policy_version TEXT,
  confirmed_payment_before_release_understanding BOOLEAN NOT NULL DEFAULT false,
  agreed_pii_handling BOOLEAN NOT NULL DEFAULT false,
  agreed_account_notifications BOOLEAN NOT NULL DEFAULT false,
  marketing_consent BOOLEAN NOT NULL DEFAULT false,        -- always separate/optional, never bundled

  -- Onboarding / approval state — registration is NOT approval (§8 of the brief)
  application_status TEXT NOT NULL DEFAULT 'PENDING_REVIEW'
    CHECK (application_status IN ('PENDING_REVIEW','NEEDS_MORE_INFO','APPROVED','REJECTED','SUSPENDED')),
  application_reference TEXT NOT NULL UNIQUE,              -- shown to the applicant, e.g. HLX-BYR-000001
  -- Internal only — never shown to the buyer. Assists admin review, does not auto-reject (brief §: "The clever part").
  internal_suitability_score INTEGER,
  internal_suitability_notes TEXT,

  -- Agreed terms once approved (admin-set, not self-service)
  agreed_price_per_lead NUMERIC,
  agreed_pricing_notes TEXT,

  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_buyers_application_status ON buyers(application_status);
CREATE INDEX idx_buyers_industry ON buyers(industry_id);

CREATE TABLE buyer_notification_preferences (
  id SERIAL PRIMARY KEY,
  buyer_id INTEGER NOT NULL REFERENCES buyers(id),
  email_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  paused BOOLEAN NOT NULL DEFAULT false,                   -- buyer-set temporary pause
  paused_until TIMESTAMPTZ,
  -- Changes to coverage/capacity are self-service; changes to pricing/contractual terms are not
  -- (brief §7) — enforced in application code, not the schema, but flagged here for reviewers.
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE consent_records (
  id SERIAL PRIMARY KEY,
  buyer_id INTEGER REFERENCES buyers(id),
  lead_id INTEGER,                                         -- nullable FK to leads, added once leads table exists in use
  wording_version TEXT NOT NULL,
  collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL,
  purpose TEXT NOT NULL,
  named_recipient_or_category TEXT,
  evidence_ref TEXT,
  withdrawn_at TIMESTAMPTZ
);

CREATE TABLE leads (
  id SERIAL PRIMARY KEY,
  industry_id INTEGER NOT NULL REFERENCES industries(id),
  service_requirement TEXT,
  homeowner_name TEXT,
  homeowner_contact JSONB,                                 -- never exposed pre-payment; see app-layer redaction
  property_type TEXT,
  postcode TEXT,
  qualification_answers JSONB NOT NULL DEFAULT '{}',
  consent_record_id INTEGER REFERENCES consent_records(id),
  source TEXT,
  acquisition_campaign TEXT,
  status TEXT NOT NULL DEFAULT 'NEW'
    CHECK (status IN ('NEW','QUALIFICATION_PENDING','QUALIFIED','AVAILABLE','RESERVED',
                       'PAYMENT_PENDING','PAID','DELIVERED','REJECTED','EXPIRED',
                       'PAYMENT_FAILED','PAYMENT_UNDER_REVIEW','REFUNDED','DISPUTED','WITHDRAWN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_industry ON leads(industry_id);

-- 24-hour exclusive allocation engine (brief: "Time-Limited Lead Allocation and Exclusivity System").
-- One row per buyer this lead was offered to, in sequence. allocation_sequence tracks which
-- exclusive attempt this is (1st, 2nd, ...) before the lead falls into shared inventory.
CREATE TABLE lead_allocations (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id),
  buyer_id INTEGER NOT NULL REFERENCES buyers(id),
  allocation_type TEXT NOT NULL CHECK (allocation_type IN ('EXCLUSIVE_WINDOW','SHARED')),
  allocation_sequence INTEGER,                              -- 1, 2, ... for exclusive windows; null for shared
  status TEXT NOT NULL DEFAULT 'OFFERED'
    CHECK (status IN ('OFFERED','DECLINED','EXPIRED','ACCEPTED','PURCHASED','SUPERSEDED')),
  notified_at TIMESTAMPTZ,
  reservation_expires_at TIMESTAMPTZ,                       -- server-computed, never trust buyer's clock
  decided_at TIMESTAMPTZ,                                   -- accept/decline timestamp
  agreed_price NUMERIC,
  exclusivity_terms JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lead_allocations_lead ON lead_allocations(lead_id);
CREATE INDEX idx_lead_allocations_buyer ON lead_allocations(buyer_id);
CREATE INDEX idx_lead_allocations_status ON lead_allocations(status);
-- Supports the scheduled-expiry job's query: "find all OFFERED exclusive allocations past their expiry".
CREATE INDEX idx_lead_allocations_expiry ON lead_allocations(status, reservation_expires_at)
  WHERE status = 'OFFERED';

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  lead_allocation_id INTEGER NOT NULL REFERENCES lead_allocations(id),
  provider TEXT NOT NULL DEFAULT 'tide_manual',             -- 'tide_manual' until Tide API question resolved
  payment_link TEXT,
  expected_amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  transaction_reference TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','PAID','SETTLED','UNDER_REVIEW','FAILED','REFUNDED','DISPUTED')),
  verified_at TIMESTAMPTZ,
  verified_by TEXT,                                         -- admin username for manual reconciliation
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE deliveries (
  id SERIAL PRIMARY KEY,
  lead_allocation_id INTEGER NOT NULL REFERENCES lead_allocations(id),
  delivery_method TEXT NOT NULL DEFAULT 'email',
  delivered_to_email TEXT,
  delivered_at TIMESTAMPTZ,                                 -- the clock the 3-day replacement window runs from
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENT','FAILED'))
);

-- Replacement requests under the Spray Foam Removal Replacement Policy (confirmed 2026-11-04).
CREATE TABLE replacement_requests (
  id SERIAL PRIMARY KEY,
  delivery_id INTEGER NOT NULL REFERENCES deliveries(id),
  requested_by_buyer_id INTEGER NOT NULL REFERENCES buyers(id),
  reason TEXT NOT NULL,
  documented_contact_attempts JSONB NOT NULL DEFAULT '[]',  -- [{type, date, notes}], required evidence
  status TEXT NOT NULL DEFAULT 'PENDING_ADMIN_REVIEW'
    CHECK (status IN ('PENDING_ADMIN_REVIEW','APPROVED_REPLACED','DENIED')),
  admin_decision_notes TEXT,
  decided_by TEXT,
  decided_at TIMESTAMPTZ,
  replacement_lead_id INTEGER REFERENCES leads(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id SERIAL PRIMARY KEY,
  actor TEXT,                                               -- admin username, 'system', or buyer reference
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  previous_state JSONB,
  new_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Append-only by convention: application code must never UPDATE or DELETE rows here (Phase 1 §7).

CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);

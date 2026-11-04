# Halo Lead Exchange — Buyer Email Marketing & Retention: Architecture Plan

Status: **PLAN ONLY. No code written, no migrations added, nothing implemented, nothing deployed.**
Per Fabien's explicit instruction: document the data fields and integration points now; prioritise
finishing admin functionality, buyer/lead management and the purchasing workflow before building any
of this.

---

## 1. What already exists that this can build on

- **`buyers.marketing_consent`** already exists as a standalone boolean, captured on the application
  form as a clearly optional, separate checkbox ("I'd also like to receive occasional marketing
  updates") — **never bundled with Buyer Terms or Replacement Policy acceptance**. The distinction
  Fabien is insisting on here is already real in the live form, not just a future promise.
- **`buyer_notification_preferences`** (`email_notifications_enabled`, `paused`, `paused_until`)
  already exists and already covers exactly the *operational* side of this brief — new-lead-match
  notifications, account/transaction emails. This table is the right home for the "Welcome,"
  "Onboarding," and "New opportunities" email types; it should not be reused for marketing.
- **Buyers and leads are already structurally separate** (`buyers` vs `leads`, no shared table, no
  foreign key between a homeowner record and a buyer's marketing status). Fabien's "don't use the
  homeowner lead database as a marketing list" requirement is already true by construction, not
  something that needs enforcing later.

## 2. Real gaps

**Gap 1 — marketing consent has no version/timestamp/source**, unlike every other consent field on
`buyers` (`agreed_buyer_terms_at`/`_version`, `acknowledged_replacement_policy_at`/`_version`).
`marketing_consent` is currently a bare boolean. If the marketing consent wording ever changes, there's
no way to know which version a given buyer actually agreed to.

**Gap 2 — no suppression mechanism at all.** Nothing currently prevents an unsubscribed contact from
being re-added to a campaign, because there's no durable, buyer-independent suppression record. A
suppression must survive even if the buyer's own row is later deleted and they reapply with the same
email (exactly the scenario this session just handled manually for a test record).

**Gap 3 — no campaign or engagement history.** Nothing tracks what was sent, to whom, when, or how it
performed.

**Gap 4 — no unsubscribe mechanism.** No token, no link, no endpoint.

**Gap 5 — no provider integration point.** Nothing abstracts "send to the marketing provider" the way
the payments plan already abstracts "send to Tide" — needed for the same reason: don't hard-code Brevo,
Mailchimp, or any other vendor into the core data model.

## 3. Proposed schema additions (not yet written as migrations)

```
-- One change to the existing buyers table, same pattern as the terms/policy consent fields:
buyers                          -- ADD: marketing_consent_at, marketing_consent_version,
                                 -- marketing_consent_source (e.g. 'buyer_application_form')

-- Permanent, keyed by email independent of buyer_id -- this is the record that must survive
-- even if the buyer row itself is deleted and recreated.
buyer_marketing_suppressions    (id, email UNIQUE, suppressed_at, reason
                                 ['unsubscribed'|'bounced_hard'|'complained'|'manual_admin_action'],
                                 source, created_by)
                                 -- Checked before EVERY marketing send and before EVERY
                                 -- campaign-segment build. A buyer's own marketing_consent flag
                                 -- can be TRUE and they can still be suppressed (e.g. after a hard
                                 -- bounce) -- suppression always wins.

email_campaigns                 (id, name, campaign_type ['transactional'|'marketing'], provider,
                                 provider_campaign_id, segment_definition JSONB, status, created_by,
                                 sent_at, created_at)
                                 -- segment_definition describes the filter used (industry, service
                                 -- category, territory, buyer status, purchase model) rather than a
                                 -- separate segments table -- segmentation is a query over existing
                                 -- buyer fields (industry_id, services_offered, counties_covered,
                                 -- application_status, purchase_model_preference), not new data.

email_campaign_events           (id, campaign_id, buyer_id, email, event_type
                                 ['sent'|'delivered'|'opened'|'clicked'|'bounced'|'complained'|
                                 'unsubscribed'], provider_event_id, occurred_at)
                                 -- Populated from whatever the chosen provider's webhook/API
                                 -- actually supports; not every provider reports every event type,
                                 -- so this schema tolerates partial data rather than assuming full
                                 -- coverage.

unsubscribe_tokens              (id, buyer_id, email, token UNIQUE, created_at, used_at)
                                 -- One-click unsubscribe: a signed/random token per email sent,
                                 -- not a login-gated preference page -- the recipient shouldn't need
                                 -- an account to opt out.
```

## 4. The transactional/marketing split, explicitly

| Email type | Classification | Governed by |
|---|---|---|
| Welcome | Transactional | `agreed_account_notifications` (already captured, mandatory to use the platform) |
| Onboarding (lead criteria, purchasing, payment) | Transactional | Same as above |
| New opportunities (lead-match notifications) | Transactional | `buyer_notification_preferences` (already exists) |
| Relationship marketing (industry insights, updates) | Marketing | `marketing_consent` + suppression check |
| Commercial offers (packages, territories, volume deals) | Marketing | `marketing_consent` + suppression check |

A buyer can opt out of transactional *lead-match* notifications (pause their account) without that
being marketing unsubscribe, and can withdraw marketing consent without that affecting their
operational account emails. The two are independent switches, not one combined preference.

## 5. Provider integration point

Same principle as the Tide payment adapter: the schema and application logic should talk to an
internal `email_campaigns`/`email_campaign_events` model, with a thin adapter layer translating to
whichever provider is actually chosen (Brevo, Mailchimp, or another) later. Nothing here should assume
a specific provider's API shape. Fabien's instinct not to pay for another subscription yet, and to
treat Instantly as the wrong home for opted-in buyer marketing (it's built for cold outbound, not
consented relationship marketing — a meaningfully different compliance posture), is the right call and
isn't contradicted by anything in this schema.

## 6. What this explicitly does not include yet

- No campaign-sending code, no provider account, no provider API integration.
- No admin UI for building a segment or composing a campaign.
- No unsubscribe page/endpoint (needs the token mechanism above to exist first).
- No decision on which provider to use — deliberately deferred, per Fabien's own instruction not to
  commit to a subscription before the buyer database and consent model are established.

## 7. Where this sits in the build order

This follows, not precedes, the already-agreed sequence: admin bootstrap (done) → application
review/approval → lead management → individual purchasing/payment → prepaid packages → **then** this
module. There is nothing to segment or email meaningfully until real buyers exist past the application
stage, same reasoning already applied to why payments wait for real leads to exist.

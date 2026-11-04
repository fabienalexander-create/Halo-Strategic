# Halo Lead Exchange — Prepaid Packages & Payment Workflow: Review & Plan

Status: **PLAN ONLY. No code written, no migrations added, nothing implemented.** Per Fabien's own
instruction: finish admin bootstrap and production verification of the existing buyer application
flow first. This document exists so the plan is ready the moment that's done — it is not a green
light to start building.

---

## 1. What already exists that this brief can reuse

- **`payments` table already has the right shape for individual lead purchases**, almost unchanged:
  `provider`, `payment_link`, `expected_amount`, `currency`, `transaction_reference`, and critically a
  `status` enum that **already preserves `PENDING`/`PAID`/`SETTLED`/`UNDER_REVIEW`/`FAILED`/
  `REFUNDED`/`DISPUTED`** — exactly the Paid/Settled/In-Review distinction §5 of the new brief asks for.
  This was built in the original Phase 1 schema, before this brief existed, and already satisfies most
  of §4A and §5's structural requirements for pay-as-you-go.
- **`buyers.agreed_price_per_lead`** already exists as a per-buyer pricing override column — a starting
  point for "pricing configurable by buyer," though it needs a companion industry-level default (see
  Gap 1 below).
- **`audit_log`** (append-only, already enforced by convention) is the right place for every credit
  adjustment's reason/timestamp/audit trail requirement in §3.
- **The replacement-policy machinery (`replacement_requests`, `deliveries.delivered_at`)** is unrelated
  to payments but worth noting: a replacement lead consumes no additional credit and needs no new
  payment — that should be made explicit in the credit-ledger transaction types below.

## 2. Real gaps — what doesn't exist yet

**Gap 1 — `payments` is hard-wired to one lead, not to "a purchase."** Its `lead_allocation_id` is
`NOT NULL`, so there's currently no way to record a payment for a prepaid package, which has no
associated lead at the time of purchase. This needs a generic purchase concept sitting above both
individual-lead and package purchases, not a second parallel payments table.

**Gap 2 — no credit ledger or balance at all.** Nothing in the current schema tracks prepaid credits,
reservations, or consumption.

**Gap 3 — no package definitions.** Admin-configurable package sizes/pricing (§2, §9: "do not hardcode
these figures") don't exist as data anywhere; they're currently only the illustrative numbers in this
brief.

**Gap 4 — no industry-level default pricing.** `buyers.agreed_price_per_lead` covers per-buyer override,
but there's no fallback default per industry for buyers without a specific agreement yet.

**Gap 5 — concurrency control for credit spend.** Nothing currently prevents two simultaneous
reservations from spending the same credit — this needs a real mechanism, not just a convention (see
§4 below).

## 3. Proposed schema additions (not yet written as migrations)

```
industries                    -- ADD: default_price_per_lead (nullable; buyer-specific override wins)

package_definitions            (id, industry_id, name, credits, price_per_credit, total_price,
                                min_credits, currency, active, created_by, created_at)
                                -- admin-configurable; "5 leads / £325 / £65-per-lead" becomes a row
                                -- here, not a constant in code

purchase_orders                (id, buyer_id, order_type ['INDIVIDUAL_LEAD'|'PACKAGE'],
                                lead_allocation_id NULLABLE, package_definition_id NULLABLE,
                                internal_reference UNIQUE,   -- HLX-PAY-xxxxxx / HLX-PKG-xxxxxx
                                credits_purchased NULLABLE,   -- only set for PACKAGE orders
                                total_amount, currency, status, created_at)
                                -- CHECK: exactly one of lead_allocation_id / package_definition_id
                                -- is set, matching order_type

-- `payments` gets ONE change: lead_allocation_id NOT NULL -> purchase_order_id NOT NULL,
-- referencing purchase_orders instead. Everything else about it stays exactly as built.
-- ALSO: add UNIQUE constraint on transaction_reference (once populated) -- directly closes the
-- "same Tide payment applied to two orders" risk named in §4.

buyer_credit_ledger            (id, buyer_id, purchase_order_id NULLABLE, lead_allocation_id NULLABLE,
                                transaction_type ['PURCHASED'|'RESERVED'|'CONSUMED'|'RELEASED'|
                                'REPLACEMENT_CREDIT'|'ADJUSTMENT'|'REFUND_ADJUSTMENT'],
                                credits_delta,                -- +10 on purchase, -1 on reserve, etc.
                                reason, created_by, created_at)
                                -- append-only, same convention as audit_log. Never update a row;
                                -- the balance is derived, not stored-and-overwritten (brief §3
                                -- explicitly requires this).

buyer_credit_balances           (buyer_id PRIMARY KEY, credits_purchased, credits_reserved,
                                credits_consumed, credits_released, updated_at)
                                -- a maintained summary, NOT the source of truth (the ledger is) --
                                -- exists purely so a credit reservation can take a row-level lock
                                -- (SELECT ... FOR UPDATE) on one row instead of re-summing the whole
                                -- ledger under concurrent load. Every write to this table happens in
                                -- the same transaction as the corresponding ledger insert, never
                                -- independently.
```

## 4. The concurrency question, answered concretely

§3's requirement ("prevent two simultaneous purchases from spending the same credit") needs a real
mechanism, not just careful code. Proposed approach: a credit reservation is:

1. `BEGIN`
2. `SELECT ... FROM buyer_credit_balances WHERE buyer_id = $1 FOR UPDATE` — this blocks a second
   concurrent reservation attempt for the same buyer until the first transaction commits or rolls back.
3. Check `credits_purchased - credits_reserved - credits_consumed >= 1`. If not, roll back and reject.
4. Insert the `RESERVED` ledger row, update the balance row, `COMMIT`.

If the allocation then expires before purchase confirmation (brief §3), a corresponding `RELEASED`
ledger entry reverses the reservation, same pattern. This is the standard, well-understood way to do
this safely in Postgres — not a novel design, deliberately.

## 5. Payment verification idempotency

§5/§9 require idempotent verification. Concretely: marking a payment "verified" is a status transition
guarded by the current status, not a blind write — e.g. only `PENDING → PAID` and `PAID → SETTLED` are
valid transitions; attempting to re-apply `PAID` to an already-`PAID` row is a no-op, not a second
credit activation. Credit activation (for a package) or lead release (for an individual purchase)
happens exactly once, at the moment the transition is first applied, inside the same transaction as the
status update.

## 6. Accounting/commercial flags (not engineering decisions — flagging for Fabien, not deciding)

- **Prepaid cash is a liability, not revenue**, per Fabien's own framing in §8. The schema supports
  reporting "credits purchased minus credits consumed, valued at the paid rate" as an outstanding
  obligation figure — but the actual revenue-recognition treatment (when prepaid cash becomes
  recognised revenue under whatever accounting standard Halo follows) is a question for an accountant,
  not something this plan encodes as a specific rule.
- **Package validity/expiry is explicitly not decided yet** (§8: "do not invent or publish an expiry
  policy without approval"). The schema has a nullable expiry field ready; no default expiry logic
  will be written until Fabien approves a specific policy.

## 7. What this explicitly does NOT include yet, and why

- **No Tide API integration** — unverified capability, per the brief's own instruction and the
  still-open questions with Tide Business Support from the Phase 1 doc §9.
- **No buyer-facing purchase UI** — there's no buyer portal/login yet (admin Priority 6, not built).
  A buyer can't "select a package" through an interface that doesn't exist.
- **No wiring into the 24-hour allocation engine** — that engine itself isn't built yet (admin
  Priority 7). This plan's credit-reservation logic is designed to slot into it later, not to
  duplicate or pre-empt it.
- **Sequencing dependency worth naming explicitly**: this payment/credit layer can't be meaningfully
  tested without real leads to purchase, which means it naturally follows admin Priority 3 (lead
  management), not before it. Building payments against zero real leads would repeat the exact mistake
  already avoided once this session (building the allocation engine before leads existed to allocate).

## 8. Recommended implementation order, once unblocked

1. Finish current verification (admin bootstrap, buyer application lookup test, duplicate-email test) —
   **in progress, blocking everything below.**
2. Admin Priority 2 (application review/approval) and Priority 3 (lead management) — buyers and leads
   need to exist for real before a purchase can be tested end to end.
3. `package_definitions` + `purchase_orders` + ledger schema (this document's §3), as migrations.
4. Individual-lead purchase flow (Option A) first — simpler, reuses the existing `payments` table
   structure almost unchanged.
5. Prepaid packages (Option B) — once Option A is proven, since it shares the same `purchase_orders`/
   `payments` machinery.
6. Admin screens for all of the above (§9 of the brief).
7. Reporting (§10) — once there's real data to report on.

Nothing here starts until Fabien says go, and not before the current verification work is done.

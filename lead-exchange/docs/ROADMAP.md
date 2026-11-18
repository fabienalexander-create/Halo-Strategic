# Halo Lead Exchange — product roadmap

Status: planning document only. Nothing here is built, scheduled, or committed to beyond
Stage 1. Written down so the staged thinking survives past one conversation, for whoever (human
or Claude session) picks this up next.

## The four stages

**Stage 1 — Make the engine work (current priority).** Meta and website acquisition, lead
qualification, consent management, buyer matching and allocation, payment and lead release,
replacement management. The milestone is proving one lead can travel from homeowner enquiry to a
paying buyer, end to end, for real — not 324 passing tests, an actual payment and an actual
release.

**Stage 2 — Prove the commercial model.** Not a fixed buyer count. The real signals:
- 10 active buyers.
- At least 3–5 buying repeatedly, not just once.
- Multiple active geographic territories.
- A consistent, proven lead-delivery process.
- Enough manual admin load (chasing payments, coordinating replacements, re-sending lead details
  by hand) that self-service would save meaningful time.

Ten clients who each bought one lead and never came back is not this milestone. A handful of
buyers generating real ongoing admin overhead is a stronger signal than a headcount.

**Stage 3 — Build the client-facing buyer portal.** Buyers get their own login and manage their
own relationship with Lead Exchange without going through Fabien for everything. Proposed
sections:

| Section | What the buyer can do |
|---|---|
| Dashboard | See leads received, accepted, pending and performance |
| Lead marketplace | View available anonymised leads and purchase them |
| My leads | Access purchased homeowner details and lead history |
| Coverage | Manage locations, postcodes and services |
| Billing | View payments, invoices and transaction history |
| Support | Submit replacement requests and track outcomes |

Each buyer sees only their own data. Tenant isolation, permissions and audit trails are
foundational to this stage, not an afterthought bolted on once it's built.

**Stage 4 — Scale and potentially white-label.** Once the platform has proven itself, explore
licensing the underlying infrastructure to other agencies and operators. This would give Halo
Strategic three potential layers of value: the consultancy, the lead marketplace's own revenue,
and a licensable platform.

## Designing Stage 1 and 2 with Stage 3 in mind

Don't build the portal before the engine has earned it. But a few architectural habits now cost
nothing and avoid an expensive retrofit later:

- Every table a buyer would eventually need to see (`lead_allocations`, `payments`,
  `homeowner_confirmations`, and anything added after this doc) already carries `buyer_id` on
  every row. Keep that true for anything new — never add a table that would need a
  buyer-scoping column bolted on later.
- Keep buyer-facing data access shaped as if it were already scoped to one buyer at a time, even
  while only `requireAdmin` (not yet `requireBuyer`) is the thing calling it. A query written
  today as "all allocations for this buyer_id" is a one-line change to serve a buyer's own login
  later; a query written as "all allocations" is a rewrite.
- Payment, consent and audit records already exist as append-only, per-allocation rows (not a
  single mutable summary) — this is already the right shape for a future "Billing" or "My leads"
  section to read from directly, without new aggregation logic.

None of this means starting Stage 3's actual UI, auth, or tenant-isolation work now. It means not
making Stage 1/2 decisions that would make Stage 3 harder than it needs to be.

# HVAC Qualified-Lead Framework — DRAFT, NOT APPROVED

Status: proposal only. Nothing in this document is live, published, contractual,
or promised to any buyer. It exists so Fabien has a concrete starting point to
edit, reject, or approve rather than a blank page. Do not treat any line here
as a commitment until explicitly approved and moved into a buyer agreement.

## Purpose

`/hvac-leads` currently tells a prospective buyer *that* leads will be
qualified against criteria agreed upfront, but doesn't say what the default
starting criteria are. This draft is that starting point — a buyer would
still negotiate specifics on the discovery call, but Halo would be
negotiating from a defined baseline instead of a blank one.

## Proposed baseline qualification criteria

A lead would count as qualified if **all** of the following hold:

1. **Genuine prospective customer** — a real individual or business
   representative, not a bot/spam submission.
2. **Genuine HVAC requirement** — the enquiry describes an actual HVAC
   need (install, repair, maintenance, replacement), not an unrelated
   enquiry that landed on the form by mistake.
3. **Valid contact information** — a reachable phone number and/or email;
   both verified to the extent the intake tooling allows.
4. **Within agreed service area** — matches the buyer's declared
   service radius/zip codes, agreed before the campaign launches.
5. **Matches agreed service type** — matches whichever service
   categories the buyer opted into (e.g. install vs. repair-only vs. both),
   also agreed before launch.
6. **Not a duplicate** — not the same contact already delivered to this
   buyer within [PROPOSED: 90 days — needs Fabien's number].
7. **Not a job-seeker or vendor enquiry** — excludes people applying for
   work or pitching services to the HVAC company itself.
8. **Not otherwise excluded under the buyer agreement** — a catch-all for
   whatever additional exclusions a specific buyer negotiates.

## Open questions this draft does NOT answer (need Fabien's decision)

- **Verification method** — is contact info verified how (phone
  ping/SMS confirmation, manual review, nothing)? Nothing implemented yet.
- **Duplicate window** — 30/60/90 days? Per-buyer or network-wide?
- **Invalid-lead process** — how does a buyer dispute a lead, what's the
  turnaround, is it a credit, refund, or replacement lead?
- **Exclusivity** — sold to one buyer per area, or shared among several?
  This is probably the single highest-impact commercial decision in the
  whole framework, and the page currently defers it to the call, correctly.
- **Delivery mechanism and speed** — email, SMS, CRM webhook, shared
  spreadsheet? Real-time or batched?
- **Pricing** — flat PPL rate, tiered by service type, or negotiated
  per buyer? Page currently defers this to the call, correctly.
- **Performance measurement** — what does Halo report back to a buyer,
  and how often (appointment rate? job-close rate? buyer self-reports?)

## Recommendation

Nothing on `/hvac-leads` needs to change today — the page already correctly
avoids promising specifics it can't back up (pricing and exclusivity are
explicitly deferred to the discovery call in the FAQ). This document exists
so that when the first real buyer conversation happens, there's a starting
draft to negotiate from instead of starting cold.

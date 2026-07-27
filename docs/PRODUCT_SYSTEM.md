# PRODUCT_SYSTEM.md

Status: Restructured 2026-07-27 per Fabien's repositioning decision. Supersedes the prior 6-stage/14-product structure (Sprint 5.6) with a simpler 4-stage narrative arc and 5 named products. **Pricing is unchanged from Sprint 5.6 and was deliberately not revisited in this restructuring** ("Pricing is a separate strategic decision and should not change in this sprint... revisit pricing with real market feedback" once 10-20 prospects have been spoken to). Nothing in the Halo Bible's foundation sections is touched or re-derived here; `docs/HALO_BIBLE.md` Section Ten carries a dated amendment note pointing here.

Every product below traces to the Leakage → Friction → Constraint → Alignment hierarchy and is checked against Halo's First Law: diagnosis before prescription, always.

---

## The Governing Sentence

> Every engagement begins with diagnosis. Not every client needs a Commercial Audit. Not every Commercial Audit leads to a Transformation project. And not every Transformation requires an ongoing Strategic Partnership. Our responsibility is to recommend what is genuinely in your business's best interests, not to move you through a predefined sales journey.

This is live on `/product-journey` and should govern how every product below is described anywhere else on the site: as an offer that's genuinely appropriate, never as the next rung on a ladder everyone is assumed to climb.

## Why this restructured (2026-07-27)

The prior structure named 14 separate products across 6 stages (Discover, Investigate, Design, Implement, Optimise, Partnership). Several were flagged as genuinely unresolved: Quarterly Commercial Review vs. Constraint Review had unconfirmed overlap; Growth Partner vs. Fractional Growth Strategist had no real distinction; Lead Management System and Growth Board had been dropped from an earlier draft without confirmation. Rather than resolving each individually, Fabien's repositioning consolidates them: Design and Implement's four products collapse into one flexible **Commercial Transformation** project (scoped per engagement, not four separately-named offerings), and Optimise and Partnership's four products collapse into one **Strategic Partnership** relationship. This resolves the Quarterly/Constraint Review question and the Growth Partner/Fractional Growth Strategist question by consolidation rather than by picking a winner, consistent with Fabien's own reasoning: "you'll naturally discover whether they're separate products or simply stages within the same engagement" once real client work exists. Lead Management System and Growth Board remain unaddressed by this restructuring, a separate open item.

---

## Product Hierarchy

| Stage | Purpose | Products |
|---|---|---|
| **Clarity** | Understand what is actually happening | Commercial Health Check, Commercial Diagnostic |
| **Strategy** | Go deep, build the roadmap | Commercial Audit |
| **Transformation** | Remove the highest-priority constraint | Commercial Transformation |
| **Partnership** | Ongoing commercial advisory, if wanted | Strategic Partnership |

## Journey Map

**Health Check → Diagnostic → Audit → Commercial Transformation → Strategic Partnership.**

A client can enter at any stage if they arrive with an existing diagnosis, but the default path is sequential, each stage's output is the next stage's entry criteria. No stage below Clarity should be sold to a client who hasn't been through a diagnosis first, whether Halo's or a genuinely equivalent one. Per the Governing Sentence above, most clients should not be expected to reach Partnership, and that's by design, not a funnel failure.

---

## Clarity

### Commercial Health Check
- **Definition:** a free, 10-minute self-assessment determining whether a full Commercial Diagnostic is appropriate.
- **Entry criteria:** none. Open access.
- **Deliverables:** an immediate score, a short narrative of likely leakage areas.
- **Outcomes:** the client has a first, low-commitment signal of whether further diagnosis is worth pursuing.
- **Pricing:** Free.
- **Upgrade path:** Commercial Diagnostic.

### Commercial Diagnostic
- **Definition:** Halo's flagship entry product. A structured 90-minute session identifying the client's primary commercial constraint. No promise to fix anything, the promise is clarity.
- **Entry criteria:** none beyond booking (or arriving via the Health Check).
- **Deliverables:** identification of the primary commercial constraint; a written Executive Summary; prioritised next steps; a recommendation on whether further work is even needed.
- **Outcomes:** the client leaves with materially more clarity about what's holding the business back and what should happen next (this is the basis for the Halo Clarity Guarantee, see `GUARANTEE.md`).
- **Pricing:** $995 (unchanged, held deliberately, see Status above).
- **Upgrade path:** Commercial Audit, only if warranted.

---

## Strategy

### Commercial Audit
- **Definition:** Halo's flagship engagement. A full evidence-based investigation across CRM, lead flow, sales process, marketing, customer journey, commercial reporting, internal systems, and leadership alignment. The output is a comprehensive commercial roadmap, not a list of findings.
- **Entry criteria:** typically follows a Diagnostic; a business that already knows it needs deep work could enter directly.
- **Deliverables:** full report and strategic recommendations, Halo Score baseline, comprehensive commercial roadmap.
- **Outcomes:** the business has a complete, evidence-based picture of where its commercial system is leaking, where the friction is, and what the primary constraint is.
- **Pricing:** $7,500+ (unchanged, held deliberately, see Status above).
- **Upgrade path:** Commercial Transformation, only if warranted.

---

## Transformation

### Commercial Transformation
- **Definition:** not "Implementation," Implementation sounds like installing software. A project scoped to the specific constraint the Audit found, never sold without one behind it. Every project is different.
- **Entry criteria:** an identified constraint from a completed Audit (or genuinely equivalent existing diagnosis).
- **Examples (illustrative, not separately priced sub-products):** CRM redesign, sales process redesign, lead management, automation, a KPI framework, a full commercial operating system.
- **Deliverables:** scoped per project; whatever the identified constraint actually requires.
- **Outcomes:** measurable movement on the metric the constraint was named against.
- **Pricing:** by proposal, scoped to the project (unchanged in substance from the prior four separately-named products, which were also proposal-based).
- **Guardrail (carried forward):** the AI/automation examples above are the ones most at risk of drifting into "selling a technology" rather than "removing a constraint." No client should receive a Transformation project without a named constraint behind it, consistent with Halo's First Law.
- **Upgrade path:** Strategic Partnership, only if warranted.

---

## Partnership

### Strategic Partnership
- **Definition:** not "Monthly Retainer." After a Transformation, some clients choose to retain Halo as an ongoing commercial adviser, providing strategic guidance, performance reviews, and independent challenge as their business evolves.
- **Entry criteria:** typically follows a completed Transformation.
- **Deliverables:** ongoing strategic guidance; performance reviews (absorbing what were previously separately-named Quarterly Commercial Review and Constraint Review); independent challenge as the business evolves.
- **Outcomes:** the business retains ongoing access to Halo's judgement without creating dependency, "protects alignment a business has already achieved," per the existing live copy on `/product-journey`.
- **Pricing:** by arrangement, no figure advertised. "People who need it will ask" (Fabien, 2026-07-27).
- **Upgrade path:** none; top of the journey, and explicitly not the assumed destination for every client.

---

## Open items carried forward

- **Pricing itself.** Deliberately not revisited in this restructuring. Revisit once Fabien has spoken to 10-20 real prospects, per his own instruction, not before.
- **Lead Management System and Growth Board**, from the original 16-product draft, remain unaddressed. Not part of the current 5-product structure; whether they resurface as Transformation examples or stay dropped is still open.
- **US-market/currency positioning.** Still open, see `PRICING_STRATEGY.md` and `docs/ARCHITECTURAL_DECISIONS.md` ADR-010's Pending Decisions. USD remains live; Fabien's stated reasoning (2026-07-27) leans toward keeping USD given an increasingly US-oriented target market (ADU companies, agencies, and direct exposure via GQL), but this hasn't been formalised as a closed decision.
- **Agency Partnerships pricing/terms**, see `agency-partnerships.html` and ADR-011, still routed to a Partner Strategy Call, not a published figure.

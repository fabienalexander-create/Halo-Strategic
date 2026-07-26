# PRICING_STRATEGY.md

Status: Sprint 5.6 (2026-07-26). Adopted as a working document. Presents options with rationale rather than a decided outcome, per this sprint's explicit rule for unresolved commercial decisions. Nothing below should be read as already approved or implemented.

---

## Current vs. Proposed: Commercial Diagnostic

**Current position:** live on the site today, free, 45-minute entry call. No stated refund or guarantee mechanism, because there's no payment to refund.

**Proposed position:** paid, approximately $995, with the Halo Clarity Guarantee attached (full refund if the client doesn't leave with materially more clarity, see `GUARANTEE.md`). The free entry-point role currently played by the Diagnostic would be taken over by the new Commercial Health Check.

**Commercial implications:**
- Converts a lead-generation tool into a revenue product, at the cost of a very likely drop in booking volume, a paid, structured session filters out a portion of the audience currently willing to book a free call.
- Requires a genuinely different sales conversation on the site and in outreach.
- The Health Check becomes load-bearing in a way it isn't today: it has to do the top-of-funnel job the free Diagnostic currently does, which means its content and scoring logic (not yet built, see `PRODUCT_SYSTEM.md`) need to exist and work before this repricing can safely happen.
- Currency and market: $995 is a US-dollar figure; the shift itself (from a UK, GBP-denominated site to USD pricing) is a separate, bigger decision addressed below.

**Recommendation:** don't reprice the Diagnostic until the Health Check exists and is live, sequencing matters here. An alternative is to launch the paid Diagnostic and the free Health Check simultaneously rather than sequentially, so the funnel is never missing its free entry point.

---

## Current vs. Proposed: Commercial Audit

**Current position:** live on the site today, fixed £3,000, four-week engagement. One product, one price, one duration.

**Proposed position:** approximately $7,500, with flexibility depending on scope and company size, and a duration that likely varies with scope rather than staying fixed at four weeks.

**Commercial implications:**
- A fixed price is easy to sell and compare against a competitor's; a scoped range requires a real sales conversation to land on a number, a heavier motion, but more consistent with diagnosis-before-prescription, a single fixed price for Halo's own flagship diagnostic product doesn't reflect the size or complexity of the business being diagnosed.
- At current GBP/USD exchange rates, £3,000 is roughly $3,800, meaning $7,500 represents close to a 2x increase in USD terms even before accounting for the currency switch itself, a genuine premium repositioning, not a currency-adjustment rounding.
- Existing clients or prospects already quoted the £3,000 figure would need this handled explicitly (grandfathering, direct communication, or accepting some inconsistency during a transition).

**Recommendation:** if premium positioning is the objective, this repricing is directionally consistent with it. The specific number ($7,500 vs. another figure) is a business judgement this document can't verify, it depends on what US-market boutique commercial advisory firms actually charge for comparable engagements, which would need real market research (a task for Claude Browser, not fabricated here).

---

## US market positioning: the bigger decision underneath the two above

Both repricing questions sit on top of a decision that hasn't been stated as a decision yet: is Halo repositioning itself, in part or in full, toward the US market? USD pricing throughout and an explicit "US market" objective both point that way.

Consequences flagged, not resolved:

- **Currency display on the live site.** Currently GBP throughout. USD pricing means switching the whole site's currency, running dual currency, or geo-targeting display, three different technical and commercial decisions.
- **"Selected Engagements" case studies.** The six published case studies are UK client work. If US positioning means US client acquisition, there's a gap between the evidence base and the market being targeted until US case studies exist.
- **Legal and tax entity.** Selling to US clients from a UK company has real implications (contracts, tax, potentially US state-level considerations) outside the scope of a content or pricing document, an accountant or solicitor should confirm this before US-priced products go live and start taking US payments.
- **Brand and terminology.** British spelling and phrasing currently used across the site would read as a deliberate choice or a mismatch depending on how deliberately the US positioning is executed.

**This document takes no position on whether US expansion is the right call.** It only flags that the pricing direction in this sprint is downstream of that larger decision.

---

## Risks, gathered

1. Repricing the Diagnostic before the Health Check exists creates a funnel gap.
2. The Audit's move from a fixed price to a scoped range requires a real quoting process that doesn't currently exist for this product.
3. USD pricing implies a US market strategy that hasn't been separately decided, evidenced, or resourced.
4. No competitor or market pricing research has been done. The $995 / $7,500 figures come from Fabien's own direction, not verified US-market comparables.
5. If both products reprice simultaneously, existing prospects mid-conversation at the old pricing need explicit handling, not silent inconsistency.

## Recommendation, stated as options rather than a decision

- **Option A (sequenced):** build and launch the Health Check first, confirm it performs as a genuine free entry point, then reprice the Diagnostic, then separately decide on Audit repricing and the US market question as its own, larger decision.
- **Option B (bundled):** launch Health Check, Diagnostic repricing, and Audit repricing together as one coordinated relaunch, faster, but concentrates the funnel-gap and existing-prospect risks above into a single moment.
- **Option C (pause pricing, resolve market question first):** treat the US market decision as the actual open question, resolve that first (ideally with real research via Claude Browser), and only then finalise pricing in whichever currency and market that decision implies.

No option is recommended over another here; the right one depends on how firm the US market decision already is, which this document doesn't have visibility into.

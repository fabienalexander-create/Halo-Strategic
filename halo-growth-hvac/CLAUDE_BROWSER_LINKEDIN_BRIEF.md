# Claude Browser Execution Brief — HVAC LinkedIn Campaign Setup

Status: Built 2026-09-12, for handoff to a separate Claude session with browser/LinkedIn access. Self-contained: written so it doesn't require the reader to have this conversation's context. Full strategic reasoning lives in `halo-growth-hvac/BRIEF.md`, `COMPETITOR_RESEARCH.md`, and `CREATIVE_CONCEPTS.md` in this same repo, read those first if anything below is unclear.

## Do not spend money until this is confirmed in-session

1. **Fabien has resolved `BRIEF.md` §0.** This product (selling qualified HVAC leads/appointments) runs under Halo Strategic itself, and needs an explicit, dated reconciliation with `docs/HALO_BIBLE.md` before it's treated as a settled part of Halo's positioning. If that hasn't happened, building the campaign in draft form is fine; spending money on it isn't yet. Confirm directly with Fabien before launch, don't assume this is resolved just because this brief exists.
2. **Confirm the test budget and business hours below out loud with Fabien before entering anything into Campaign Manager**, even though the numbers are now filled in. They were set as a recommendation, not observed from a live decision Fabien made in front of Claude Browser, so treat them as a starting proposal to confirm, not a rubber stamp.

Build the campaign, creative, and form in draft freely. Just don't push the button on real spend until both of the above are actually confirmed in that session.

## Test budget

**$300 total, deliberately a validation budget, not a scale-up budget.** Roughly $30/day over 10 days, or front-loaded if the campaign needs more daily spend to generate a readable signal, use judgement on the split, the $300 ceiling is the fixed part. The objective at this budget is answering five questions, not closing customers: are HVAC owners clicking, are they submitting the form, which of the two creatives performs better, what's the cost per qualified prospect, and does anyone actually want the $750 trial. If the signal is good, budget increases from here, that's a separate, later decision, not assumed now.

## Confirmation / first-response SLA

**Respond to every new lead within 15 minutes during business hours. Outside business hours, respond by 9:00 AM the following business day.** Define the actual business hours and time zone in this campaign-setup session, don't invent them silently, they need to match how Fabien (or whoever's answering leads) actually operates. A LinkedIn prospect submitting a form while actively considering the offer is worth meaningfully more with a fast response, that's the reasoning behind the 15-minute window, not an arbitrary number.

Business hours, confirmed by Fabien: **9:00 AM-6:00 PM EST, Monday to Friday.**

Lead Gen Form confirmation message: "Thanks, we've received your request. We'll follow up within 15 minutes if you're submitting Monday-Friday, 9:00 AM-6:00 PM EST, or by 9:00 AM EST the next business day otherwise."

## Objective

Get real US HVAC business owners to see this campaign, submit a Lead Gen Form, and move toward buying the **5 Qualified HVAC Opportunities — $750** trial. This is not a brand-awareness campaign and not a marketing-retainer pitch, the ask is specifically the paid trial.

## Audience

- **Location:** United States
- **Job titles or functions:** Owner, Founder, President, CEO, General Manager, Marketing Manager, Sales Manager, Business Development Manager
- **Industry:** HVAC / Heating & Air Conditioning / Building & Construction (use whichever LinkedIn industry taxonomy match is closest, check the actual options in Campaign Manager rather than assuming exact category names)
- **Company size:** Small-to-medium (LinkedIn's own size bands, prioritise local/regional contractors, not large national enterprises per `BRIEF.md` §2)

Check the audience-size estimate Campaign Manager shows before launching. HVAC as an industry filter combined with several job titles and a size cap could come back narrower than expected, same caution as the earlier LinkedIn campaign.

## Ad format

Single Image Ad (Sponsored Content), 1:1 primary (1200x1200), 1.91:1 optional (1200x627). Not carousel or video for this first test, per the same reasoning as the earlier campaign, keep the first test simple enough to read cleanly.

## The two creatives to build first

Full detail and rationale for all five concepts is in `CREATIVE_CONCEPTS.md`. Start with these two, hold the other three (B, D, E) as a second wave once these two produce real cost-per-paying-customer data, not before:

### Ad 1 — Concept A

- **Ad name:** HVAC Trial — Concept A (Exclusivity)
- **Headline (ad unit):** Stop Splitting Leads With 3 Other Contractors
- **Introductory text:** Most HVAC lead services sell the same homeowner to you and your competitors at the same time. Every opportunity Halo delivers goes to one HVAC company. Yours.
- **CTA:** closest LinkedIn preset to "See the $750 Trial" (LinkedIn CTAs are a fixed dropdown, not free text, pick the nearest match when actually looking at the options, e.g. "Learn More" or "Sign Up")
- **Creative:** not yet rendered as an image, needs a visual builder session (see "What's still missing" below)

### Ad 2 — Concept C

- **Ad name:** HVAC Trial — Concept C (Price Transparency)
- **Headline (ad unit):** $150. Per Qualified Opportunity. Not Per Dead Number.
- **Introductory text:** Most HVAC leads cost $45-$300, and a chunk of them are disconnected numbers or homeowners who hired someone else weeks ago. Test 5 real opportunities for $750, see what you actually get.
- **CTA:** closest preset to "Start the $750 Trial"
- **Creative:** not yet rendered as an image, needs a visual builder session (see below)

## Creative images

Rendered 2026-09-12 in `halo-growth-hvac/creative/generated/`: `hvac-concept-a-square.png` / `-wide.png` and `hvac-concept-c-square.png` / `-wide.png`. Built on Halo's existing navy/bronze/Fraunces template (`content/linkedin/templates/ad-offer.html`), reused as-is for speed rather than a researched decision, per the still-open question in `BRIEF.md` §6 about whether a US HVAC audience needs its own visual system. Upload the `-square` PNGs as primary (1:1 is LinkedIn's current recommended format); the `-wide` PNGs are available if the 1.91:1 placement is used too. Source data is in `halo-growth-hvac/creative/concept-a.json` and `concept-c.json` if either needs a copy tweak and re-render (`node render.js ad-offer <path-to-json> <output-name> [--wide]` from `content/linkedin/templates/`).

## What's still missing before this can actually launch

- **No landing page exists for this offer.** Given that, the pragmatic path for a first test is a **native LinkedIn Lead Gen Form** (see below) rather than an external landing page, this avoids the dependency entirely and matches how the earlier website-review campaign was built. If Fabien wants an actual landing page for this offer eventually, that's `BRIEF.md` §7, not built yet.

## Lead Gen Form

- **Form name:** HVAC 5-Opportunity Trial
- **Headline:** Get 5 Qualified HVAC Opportunities — $750
- **Supporting copy:** Test 5 exclusive, qualified homeowner opportunities in your service area. No monthly contract, see exactly what you get before buying more.
- **Fields:** Name, Company name, Work email, Phone number, Company website, Service area/location
- **Custom questions (keep short, per `BRIEF.md` §5's "don't make the form unnecessarily long"):**
  - "How many technicians does your company have?" (free text or ranges: 1-3 / 4-10 / 11+)
  - "How are you currently generating leads?" (multiple choice: Referrals / Google Ads / Angi or HomeAdvisor / Other lead services / Not actively marketing / Other)
- **CTA:** closest preset to "Start My Trial"
- **Confirmation message:** "Thanks, we've received your request. We'll follow up within 15 minutes if you're submitting Monday-Friday, 9:00 AM-6:00 PM EST, or by 9:00 AM EST the next business day otherwise." (business hours confirmed by Fabien, see "Confirmation / first-response SLA" above)
- **Privacy policy link:** `https://halostrategic.com/privacy-policy` unless Fabien specifies a different one for this US-facing offer

## A compliance note specific to this form, not the AI-SMS system

This Lead Gen Form captures **HVAC business** contact information for a B2B sales conversation, it is not the system that will later text homeowners. The TCPA one-to-one consent finding in `COMPETITOR_RESEARCH.md` §4 applies to the homeowner-facing side of this business (the AI SMS qualification system in `BRIEF.md` §8), not to this LinkedIn form. Don't conflate the two: this form is standard B2B lead capture; the homeowner consent problem is a separate, later build that needs its own legal review before any AI SMS goes live.

## Tracking

Same structure as `BRIEF.md` §11: Impressions → Clicks → Form opens → Form submissions → Qualified HVAC businesses (real company, real contact, genuinely fits the target profile) → Sales conversations → Paid trials → Repeat purchases. **Primary metric: cost to acquire one paying HVAC customer**, not raw cost-per-lead or cost-per-form-fill.

**Tracker: `halo-growth-hvac/hvac-qualified-lead-tracker.xlsx`**, built 2026-09-15, Dashboard/Campaign Summary/Leads/Zapier Setup tabs, formulas verified via a real recalculation pass. Leads should land in the "Leads" tab automatically once connected via Zapier (see that file's "Zapier Setup" tab for the exact steps, not yet built or tested in this session, no LinkedIn/Zapier access here) or be pasted in manually from a Campaign Manager CSV export in the meantime. One thing the Zapier setup tab flags and doesn't resolve: LinkedIn's form itself has no "which ad/concept did this come from" field, so either build two separate Zaps (one per ad) or accept that the Concept A/C column has to be filled in by hand per lead.

## Sequencing checklist

1. Confirm `BRIEF.md` §0 (Bible reconciliation) with Fabien
2. Confirm the $300 test budget with Fabien, out loud, in this session (business hours are now set: 9:00 AM-6:00 PM EST, Monday-Friday)
3. Build the two creative images for Concept A and Concept C
4. Set up the campaign, audience, and Lead Gen Form in Campaign Manager per this doc, using the confirmation message as written below
5. Launch, then hold changes for the same reasoning as the earlier campaign, don't touch anything before enough data accumulates to read cleanly

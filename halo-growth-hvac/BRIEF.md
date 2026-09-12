# Halo Strategic — US HVAC Lead Generation / Appointment Engine

Status: Master build brief, architecture pass only. Written 2026-09-12 from Fabien's brief. Nothing past this document is built yet, no competitor research, no creative, no landing page changes, no tech stack. This folder is where all of that will live once it's actually built, module by module, not in one sitting, same discipline as `docs/LINKEDIN_LEAD_GEN_CAMPAIGN.md`.

## 0 — This is Halo Strategic, not a separate brand: what that actually means

Fabien confirmed this runs under Halo Strategic itself, not a separate business. That's a bigger decision than it sounds, and it needs stating plainly rather than quietly built around.

**The actual tension.** `docs/HALO_BIBLE.md` (frozen, constitutional) exists specifically to distinguish Halo from agencies that sell activity instead of outcomes. Chapter 1: "our job isn't to sell marketing." Chapter 2: the industry's incentive problem is agencies whose diagnosis always concludes "buy more of what we sell." Chapter 6: "we will not hide behind vanity metrics," "we will not recommend work that isn't needed." This brief describes Halo generating and selling qualified leads/appointments to HVAC companies on a pay-per-unit basis, no diagnostic engagement, no constraint analysis, a defined product sold at a fixed price per unit. Read uncharitably, that's the exact model Chapter 2 was written to critique.

**The honest reconciliation, not yet approved.** Two things make this genuinely different from "just another lead-gen agency," worth writing down so it's a real argument, not a hand-wave:

1. **Payment is tied to a verified, defined outcome (a qualified, callback-ready appointment), not activity.** A lead that never answers isn't paid for. That's closer to Halo's "outcomes not outputs" principle than a typical pay-per-lead vendor's undifferentiated contact list, and closer still than a monthly retainer paid regardless of results.
2. **This maps onto a real, already-named constraint area.** `docs/HALO_BIBLE.md` Section Four names "Acquisition Systems" as one of Halo's six constraint areas ("which channels produce customers, versus which produce leads that never convert"). This offer is Halo productising a fix for one specific, common instance of that constraint for one vertical, not inventing a parallel business with no connection to the existing framework.

**What this does NOT resolve on its own:** this is still a transactional product sold without a preceding diagnosis, which is structurally different from every other Halo product (`docs/PRODUCT_POSITIONING.md`'s "entry criteria as gates" principle, each stage requires the prior stage's output). Whether that's an acceptable, deliberate exception (a narrow, self-qualifying product for businesses that already know their constraint is acquisition volume) or a real crack in Halo's positioning is Fabien's call, not something I'm deciding by building around it quietly. **This needs an explicit, dated amendment to `docs/HALO_BIBLE.md`, in the Bible's own words, before this product line is treated as settled**, not a silent contradiction sitting next to a document that says the opposite. Flagging this as the first open item, not resolving it here.

## 1 — Objective

Build and validate a testable customer-acquisition system for Halo Strategic targeting US HVAC companies, structured around:

> Halo generates and qualifies homeowner HVAC enquiries, then delivers qualified opportunities/appointments to HVAC companies on a pay-per-qualified-appointment basis.

The immediate goal is not a marketing retainer. It's proving, in order: HVAC companies respond to the offer → they submit details → they accept a small paid trial → they pay upfront → Halo delivers profitably. Everything else in this brief serves that one proof, not a general HVAC marketing business.

**The first objective, stated precisely (per Fabien): get one real HVAC company to pay for five qualified opportunities, prove Halo can deliver those five, then repeat it.** Not a big-agency build.

## 2 — Target customer

US market. HVAC vertical. Small-to-medium, local/regional, owner-led HVAC contractors with a working phone/sales operation, actively looking for more jobs, capable of absorbing extra inbound volume, where one additional customer has meaningful economic value. Decision-makers: Owner, Founder, President, CEO, General Manager, Marketing Manager, Sales Manager, Business Development Manager. Prioritise real local businesses over large national enterprises.

**Correction from an earlier draft of this brief, now locked in:** the LinkedIn audience is HVAC business owners/decision-makers. Halo is not using LinkedIn to find homeowners. Homeowners are the product being generated and qualified downstream (§5), not the ad audience.

## 3 — Core offer

Starting offer: **5 Qualified HVAC Opportunities — $750** ($150/opportunity), positioned as a low-risk test, not a contract. Paid upfront, no open-ended credit, no end-of-month billing. Exact headline/positioning not locked, several alternatives get developed and tested (§6-7), not assumed from the first draft.

## 4 — What counts as a qualified opportunity

Not a spreadsheet of contacts. A qualified opportunity: real person, valid contact info, relevant geographic area, genuine HVAC requirement, indicated willingness to speak with an HVAC professional, appropriate timing/urgency, consent to be contacted. Worth testing whether "qualified, callback-ready appointment" (a confirmed time window, not just a warm contact) out-converts a plain "qualified lead" framing, that's a real open question, not assumed. Halo delivers the opportunity; the HVAC company still does the calling, quoting, and closing. No guaranteed sales or jobs, ever, consistent with Halo's own non-negotiable against manufactured certainty (`docs/HALO_BIBLE.md` Chapter 6).

## 5 — Customer journey (12 stages)

LinkedIn (HVAC decision-makers) → ad creative → Halo landing page → application form → follow-up (email/SMS/AI) → sales conversation → 5-lead paid trial → upfront payment → Halo generates homeowner leads → AI SMS qualification → AI books callback appointment → HVAC partner receives it and makes the call → automated reminders reduce no-shows.

## 6 — Creative direction: optimise for cost, not for winning

One correction from Fabien on how this gets briefed downstream, worth stating explicitly since it changes what "success" means for the creative work: **don't brief this as "create creatives that will win and get cheap clients."** Nobody knows which message wins until it's tested. The actual job is designing and running a set of genuinely different creative concepts (at least 5, per hook/pain-point/psychological angle) intended to **minimise qualified customer acquisition cost**, measured, not asserted. A creative "winning" is an output of the test, not a property to design in up front. This keeps whoever builds the creative module focused on the economics (§14) rather than producing something merely polished.

Pain points to explore: needing more booked jobs, paying agencies without knowing what they produce, monthly retainers, poor-quality/shared leads, leads that never answer or fall outside the service area, wanting predictable acquisition without hiring another salesperson, wanting to pay for outcomes rather than activity. Avoid generic B2B/SaaS stock-photo cliches. Halo already has a template-based creative system (`content/linkedin/templates/`, navy/bronze/Fraunces) built for the UK consultancy brand, worth deciding deliberately whether US HVAC creative reuses that visual system or needs its own, since the audience and tone here (US tradesperson business owner, not UK founder-led SME) are genuinely different, not just a copy swap.

## 7 — Landing page

A new landing page for this offer, not a blind rebuild of anything existing. The existing `diagnostic-landing.html` and `commercial-health-check.html` are built around the $995 Diagnostic funnel and share no structure with a 5-lead-trial HVAC offer, don't reuse them as a base without checking first whether that actually saves time or just imports the wrong assumptions. Needs to answer, within seconds: what do I get, how much, why trust Halo, what's the risk, what happens next. Pricing/trial terms visible, not hidden behind a "contact us." Include an application form (name, company, email, phone, website, service area, technician count/size, current lead-gen methods, approximate monthly lead volume, trial interest) kept short, not maximal.

## 8 — Technology stack (future architecture, not built yet)

Lead generation → CRM/database → AI SMS qualification (TextMagic + OpenAI/ChatGPT) → Zapier → Calendly → reminders → HVAC partner handoff. The AI asks one question at a time, maintains context, never pretends to be an HVAC technician, never diagnoses problems or quotes repair prices, confirms details, determines qualification, sets callback preference, and can hand off to a human when appropriate.

## 9 — Compliance (research required before build, not assumed)

US SMS marketing and TCPA consent requirements, disclosure rules for AI-generated SMS, LinkedIn advertising policy, HVAC-specific advertising rules, data/privacy handling, and consent capture before any automated SMS contact. This needs real research against current US regulation, not inference from general knowledge, before any AI-SMS component goes live. Financial services is explicitly out of scope for this vertical and stays out until HVAC is validated and separately assessed.

## 10 — Competitor research (required before finalising positioning)

Current US competitors in HVAC/home-service pay-per-lead and performance-based lead generation: their pricing, guarantees, landing-page structure, ad messaging, qualification promises, and weaknesses. Used to find where Halo can genuinely differentiate, not copied.

## 11 — Success metrics

Funnel: Impressions → Clicks → Landing-page visitors → Form submissions → Qualified HVAC businesses → Sales conversations → Paid trials → Repeat purchases. **Primary KPI: cost to acquire a paying HVAC customer.** Secondary: CTR, CPC, landing-page conversion rate, cost per form submission, qualified-business rate, sales conversion rate, trial purchase rate, cost per qualified appointment delivered, revenue per client, repeat purchase rate, gross margin.

## 12 — What this session actually did (2026-09-12)

Per architecture-first, one-module-at-a-time workflow: inspected the existing repo (confirmed no US/HVAC infrastructure, no SMS/AI-qualification stack, and no landing page structurally reusable for this offer exists yet) and wrote this brief. Flagged §0 as a real open decision rather than proceeding past it. **Not done in this pass, each is a separate future module:** competitor research, creative concepts, landing page build, application form, CRM/data structure, TextMagic/AI/Zapier/Calendly architecture, compliance research.

## 13 — Before the next module starts

- [ ] §0: Fabien reviews and either approves the reconciliation framing, asks for it to be argued differently, or decides this needs a different resolution entirely, before an amendment gets written into `docs/HALO_BIBLE.md`
- [ ] Confirm whether US HVAC creative reuses the existing navy/bronze/Fraunces visual system or gets its own (§6)
- [ ] Confirm whether `docs/PRODUCT_SYSTEM.md` should note this as a new, parallel product line (a self-qualifying, no-diagnosis-gate exception to the existing entry-criteria structure) once §0 is resolved

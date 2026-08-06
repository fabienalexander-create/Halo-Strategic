# Google Ads Landing Page — `diagnostic-landing.html`

Status: Draft, live, `noindex`. Owner: Claude Code. Built 2026-07-31 per Fabien's detailed brief (10-section structure, no nav/footer, one repeated CTA, mobile-first).

## What it is

A single, standalone page at `/diagnostic-landing`, entirely separate from the main site — no shared nav, no footer links beyond a bare copyright and Privacy Policy link, no exit points except the repeated "Book Your Commercial Diagnostic" CTA. Built for paid traffic only: `<meta name="robots" content="noindex, nofollow">` keeps it out of organic search and out of `sitemap.xml`, so it never competes with `/commercial-diagnostic` for ranking or gets crawled as duplicate content.

Ten sections, in order: Hero → The Commercial Problem → Why Businesses Plateau → What a Diagnostic Actually Is → What's Included → Why Halo → Founder Credibility → How the Process Works → FAQ (all 7 requested objections) → Final CTA with an embedded Netlify form (`name="diagnostic-landing"`, tracked separately from the main contact form).

## Headline decision

Built with the problem-led hero you proposed rather than a price-led one: **"Your business probably doesn't need more marketing. It needs a clearer diagnosis."** One adaptation: your example used "£10,000," but the whole site was just brought to consistent USD pricing (see ADR-010/014, and the earlier fix removing stray `£` references) — introducing a solitary `£` figure here would undo that. Used "another five figures" instead, keeping the same rhetorical weight without a currency figure that contradicts the rest of the funnel.

## Trust signals used

- Halo Clarity Guarantee (stated twice: hero sub-note, final CTA)
- The four real, verified evidence numbers (14→1, 43%, 3→6-8, ~25%) — same figures used sitewide, nothing new invented
- Founder credibility: real bio (marketing agency founder, carpet & flooring business owner, Nordic Markets) plus the actual conference-stage photo, used as genuine proof of public recognition rather than forced into a headshot crop it was never shot for
- Explicit "no pitch deck" / "you'll be told plainly if Halo isn't the right partner" language, consistent with the honesty-forward tone established across the rest of the site
- Confidentiality is not restated here (it's an Audit-page FAQ item, not directly relevant to a Diagnostic-only page) — worth adding if ad feedback shows confidentiality is a live objection for this audience

## SEO / meta (for reference, though the page is noindexed)

- Title: "Before You Spend More on Growth, Get a Clear Diagnosis | Halo Strategic"
- Meta description: "A 90-minute Commercial Diagnostic identifies the one constraint actually limiting your growth. $995, backed by the Halo Clarity Guarantee: real clarity, or your money back."

## Google Ads message-match recommendations

Ad copy should echo the landing page's own language directly, not just the product name:

- **Headline ideas:** "Not a Marketing Problem? Find Out" / "A Clearer Commercial Diagnosis" / "Before You Spend More on Growth" — all lifted from on-page language, so the visitor reads the same words in the ad and at the top of the page.
- **Description ideas:** "A 90-minute Commercial Diagnostic identifies what's actually limiting your growth. $995, money-back guarantee." — states the price up front in the ad itself. This matters: the page delays the number until well into the hero's sub-line, which is fine for click-through (the problem-led headline earns the click) but the ad should pre-qualify on price so nobody clicks expecting a free consultation.
- **Keyword themes to bid on:** phrases matching the problem framing ("why isn't my business growing," "commercial diagnostic," "business plateaued") rather than generic "marketing agency" or "growth marketing" terms, which would mismatch the page's actual positioning and likely produce poor Quality Score from a message-match perspective.
- **Final URL:** `https://halostrategic.com/diagnostic-landing` — do not point ads at `/commercial-diagnostic` (the site page); it has full nav and a different narrative flow, and mixing the two will fragment conversion data.

## CRO notes

- Single CTA target (`#book`) used consistently everywhere, including a mobile-only sticky bottom bar, so scroll depth never costs a visitor the ability to convert.
- Form is embedded on-page rather than linking out to `/contact`, deliberately, since `/contact` offers Audit/General-enquiry options irrelevant to ad traffic that already knows why it's here.
- FAQ covers all seven objections you listed, in the order most likely to be live for a first-time visitor (agency comparison and internal-capability doubt first, price and logistics last).
- The founder-credibility section was originally spec'd as a small circular headshot; the only available photo is a wide conference-stage shot, so it's now shown at full width instead of force-cropped — this is very likely a stronger trust signal for cold traffic than a headshot would have been (public speaking recognition), but worth commissioning an actual dedicated headshot at some point since it's currently the only asset of its kind serving three different placements across the site (About's portrait, About's stage-proof, and now this page).

## Update, 2026-08-04

Added one line to the "Why Halo" section (§6): "The goal isn't more data. It's a clearer commercial decision, made with evidence instead of a guess." Added to keep this page consistent with Halo's finalised sitewide positioning ("Helping founder-led businesses make better commercial decisions" — see `index.html` hero, commit `bc30b87`), which this page predates. Deliberately did not touch the hero headline, FAQ, or CTA copy: those have documented, tested reasoning behind them (see "Headline decision" and "CRO notes" above), and the positioning idea only needed one clear landing spot, not a rewrite of proven copy with zero live traffic data yet.

## Suggested A/B tests, once traffic exists

1. **Headline: problem-led (current) vs. price-led** ("Commercial Diagnostic — $995, Find Your Real Constraint") — this is the test you specifically flagged as potentially Halo's biggest differentiator; worth running first.
2. **CTA copy**: "Book Your Commercial Diagnostic — $995" vs. a softer "Find Out What's Actually Holding You Back" (price hidden until the form itself).
3. **Founder section placement**: currently after "Why Halo" (evidence-first, then person) vs. moving it directly under the hero (person-first, matching the "lead with the founder sooner" instinct from the earlier site review) — worth testing whether that instinct holds for cold ad traffic the same way it did for organic homepage visitors.
4. **Form length**: current 4 fields (name, email, company, challenge) vs. a 2-field version (name, email only) with company/challenge deferred to a follow-up email, to see whether field count is actually suppressing submissions at this price point.
5. **Guarantee placement**: currently a small note under the hero CTA vs. promoting it to its own short section with more visual weight, given how much weight "real clarity, or your money back" is doing to lower first-time-buyer risk.

# LinkedIn Ads — Free Website Review campaign

Creative assets for the paid LinkedIn lead-gen campaign specified in `docs/LINKEDIN_LEAD_GEN_CAMPAIGN.md`. That document is the source of truth for strategy, copy rationale, targeting, economics and the lead form; this folder only holds the render-ready asset data for the two approved concepts (A: hero, D: challenger). Like `content/linkedin/`, this path is blocked from public serving (`_redirects`, `/content/*`).

## Template

Both concepts use `content/linkedin/templates/ad-offer.html`, a new addition to the shared template set (see that folder's README for the full list). Unlike the existing organic-post templates, this one is sized in `vw`/`vh` rather than fixed pixels, so the same markup renders correctly at both LinkedIn ad sizes without a second template: width (1200px either way) drives font sizes, height (1200 square vs. 627 wide) drives vertical spacing, so the wide format compresses proportionally instead of cropping.

Tokens: `HEADLINE1` / `HEADLINE2` / `HEADLINE3` (up to three headline lines, unused ones auto-hide via the `_EMPTY` convention already used elsewhere in this repo's templates), `SUPPORT` (the one-line supporting thought), `OFFER` (the bronze offer line, "FREE WEBSITE REVIEW" for both concepts). Headline text is kept white throughout rather than mixing in bronze, deliberately: `docs/HALO_BIBLE.md` Section Nine specifies bronze as "the single accent colour, never a second competing accent," and reserving it for the rule, the offer line and the footer keeps that discipline rather than letting the original brief's "bronze second headline line" idea compete with it.

The footer uses the actual Halo lockup (arc icon + bronze triangle + HALO / STRATEGIC wordmark, matching `halo-lockup-light.svg`) inlined directly in the template, not a text-only wordmark, per the brief's instruction to use the real logo rather than a simplified substitute.

## Rendering

From `content/linkedin/templates/` on a machine with Chrome or Edge installed (see that folder's README, `render.js` looks for the standard Windows install paths):

```
node render.js ad-offer ../../ads/linkedin-website-review/concept-a.json ad-website-review-concept-a-square
node render.js ad-offer ../../ads/linkedin-website-review/concept-a.json ad-website-review-concept-a-wide --wide
node render.js ad-offer ../../ads/linkedin-website-review/concept-d.json ad-website-review-concept-d-square
node render.js ad-offer ../../ads/linkedin-website-review/concept-d.json ad-website-review-concept-d-wide --wide
```

Output lands in `content/linkedin/generated/` (and the visible LinkedIn Images folder `render.js` also copies to), as PNGs ready to upload to LinkedIn Campaign Manager. Both are well under LinkedIn's 5MB image limit.

Rendered and visually checked in this session using the sandbox's Chromium (not `render.js` itself, which only targets Windows paths); layout holds correctly at both 1200x1200 and 1200x627 with no cropping or overflow. That test run's fonts fell back to a generic serif/sans (no outbound access to Google Fonts from the sandbox), so re-check the real render on a machine with live font access before shipping, since Fraunces reads noticeably more premium than the fallback.

## Ad metadata (for LinkedIn Campaign Manager)

Full copy rationale is in `docs/LINKEDIN_LEAD_GEN_CAMPAIGN.md` §3-4. Reference only, kept here so it doesn't need re-deriving from the doc every time an ad unit is set up.

### Concept A — hero

- **Ad name:** Website Review — Concept A (Problem)
- **Introductory text:** Your website might look good. That's not the same question as whether it's turning visitors into enquiries. Halo Strategic offers a free website review: a practical look at where your site may be creating friction between a visitor arriving and that visitor actually getting in touch. No obligation, just what we'd actually tell you if you asked.
- **Headline:** Is Your Website Losing You Enquiries?
- **CTA:** Request Review
- **Image alt text:** Halo Strategic ad: "Is your website losing you enquiries?" Free website review offer.
- **File format:** PNG (both `-square` and `-wide` renders)

### Concept D — challenger

- **Ad name:** Website Review — Concept D (Prescription Challenge)
- **Introductory text:** Before you spend on a redesign, ask a more useful question first: what's actually stopping your current website from converting? We'll look at your website and point out where visitors are most likely dropping off before they ever become an enquiry. No pitch for a new site. Just what we see.
- **Headline:** Find What's Holding Your Website Back
- **CTA:** Get Free Review
- **Image alt text:** Halo Strategic ad: "Before you redesign your website, find out what's actually wrong with it first." Free website review offer.
- **File format:** PNG (both `-square` and `-wide` renders)

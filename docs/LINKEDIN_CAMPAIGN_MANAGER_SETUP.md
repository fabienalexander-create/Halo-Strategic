# LinkedIn Campaign Manager Setup — Free Website Review

Status: Checklist, built 2026-09-05. Owner: Claude Code. Companion to `docs/LINKEDIN_LEAD_GEN_CAMPAIGN.md`, which is the source of truth for every value used below, nothing here introduces new strategy, copy, or targeting. This document only maps that plan onto Campaign Manager's actual screens so the manual setup doesn't require cross-referencing the other doc field by field.

I have no LinkedIn access in this environment and haven't run through these screens myself this session, so this is built from LinkedIn's documented Campaign Manager structure, not verified against a live account. LinkedIn's UI changes fairly often; if a step below doesn't match what's on screen, trust the screen and use the values here, not the exact click-path.

---

## Before you start: render the final creative

The two PNGs already in `content/ads/linkedin-website-review/` were only test-rendered in a sandbox with no live internet access, so they fell back to a generic serif font instead of real Fraunces. Re-render on a machine with normal internet access before uploading anything:

```
cd content/linkedin/templates
node render.js ad-offer ../../ads/linkedin-website-review/concept-a.json ad-website-review-concept-a-square
node render.js ad-offer ../../ads/linkedin-website-review/concept-a.json ad-website-review-concept-a-wide --wide
node render.js ad-offer ../../ads/linkedin-website-review/concept-d.json ad-website-review-concept-d-square
node render.js ad-offer ../../ads/linkedin-website-review/concept-d.json ad-website-review-concept-d-wide --wide
```

Needs a local Chrome or Edge install (see `content/linkedin/templates/README.md`). Output lands in `content/linkedin/generated/` and gets copied to the visible LinkedIn Images folder automatically. Use the `-square` PNGs as primary (1:1 is LinkedIn's current recommended format); upload the `-wide` PNGs too if you want the 1.91:1 variant available.

---

## 1. Campaign group

If this is the first Halo campaign in the account, create a Campaign Group first (Campaign Manager organises everything under one): name it something like **"Free Website Review — LinkedIn Test"**, so a second-wave test (see `docs/LINKEDIN_LEAD_GEN_CAMPAIGN.md` §2, holding Concepts B/C) has an obvious place to sit later without a rename.

## 2. Campaign objective

Choose **Lead Generation** as the campaign objective (not Website Visits or Engagement). This is what unlocks LinkedIn's native Lead Gen Form, which the whole plan depends on, per campaign doc §7.

## 3. Audience

Enter exactly the audience from campaign doc §5:

- **Location:** United Kingdom
- **Job titles or Job functions:** Founder, Co-Founder, Owner, Business Owner, CEO, Managing Director, Director, President
- **Company size:** 2-50 employees

Do not add the broader UK audience as a second audience in the same campaign, that's explicitly a second-wave test per §5, not concurrent. Check the estimated audience size Campaign Manager shows: if it's very small (a real risk combining this many job-title filters with a 2-50 employee company-size filter and UK-only geography), that's worth a decision, not a silent workaround, on whether to loosen job titles or company size before spending a single pound testing an audience too narrow to reach at £10/day.

## 4. Ad format

**Single Image Ad** (Sponsored Content). Not Carousel, not Video, per campaign doc §06 and the original brief's own reasoning: this is a £200 test meant to answer one question cleanly, not a multi-format campaign.

## 5. Budget and schedule

- **Daily budget:** £10/day
- **Duration:** approximately 20 days (campaign doc §6), or set a total budget cap of £200 instead if Campaign Manager's UI makes that the more reliable lever
- **Bid strategy:** whatever Campaign Manager's default/automated bidding is for Lead Gen objective, unless there's a specific reason to manual-bid, none is specified in the campaign doc

## 6. The two ads (Concept A and Concept D)

Build these as two ads within the same campaign, so they run against the identical audience and budget and Campaign Manager's own reporting can compare them directly. Full metadata for both is also in `content/ads/linkedin-website-review/README.md`.

### Ad 1 — Concept A (hero)

| Field | Value |
|---|---|
| Ad name | Website Review — Concept A (Problem) |
| Image | `ad-website-review-concept-a-square.png` (primary), `-wide.png` optional |
| Introductory text | Your website might look good. That's not the same question as whether it's turning visitors into enquiries. Halo Strategic offers a free website review: a practical look at where your site may be creating friction between a visitor arriving and that visitor actually getting in touch. No obligation, just what we'd actually tell you if you asked. |
| Headline | Is Your Website Losing You Enquiries? |
| CTA button | Request Review (LinkedIn's built-in CTA options may not have this exact wording, use the closest match, e.g. "Sign Up" or "Learn More" mapped to Request Review in the surrounding copy) |
| Destination | Native Lead Gen Form (see §7 below), not an external URL |
| Alt text | Halo Strategic ad: "Is your website losing you enquiries?" Free website review offer. |

### Ad 2 — Concept D (challenger)

| Field | Value |
|---|---|
| Ad name | Website Review — Concept D (Prescription Challenge) |
| Image | `ad-website-review-concept-d-square.png` (primary), `-wide.png` optional |
| Introductory text | Before you spend on a redesign, ask a more useful question first: what's actually stopping your current website from converting? We'll look at your website and point out where visitors are most likely dropping off before they ever become an enquiry. No pitch for a new site. Just what we see. |
| Headline | Find What's Holding Your Website Back |
| CTA button | Get Free Review (map to the closest built-in CTA option) |
| Destination | Same Lead Gen Form as Ad 1 |
| Alt text | Halo Strategic ad: "Before you redesign your website, find out what's actually wrong with it first." Free website review offer. |

**Flagging one real constraint:** LinkedIn's Single Image Ad CTA button is a fixed dropdown of preset options (things like "Learn More," "Sign Up," "Download," "Register"), not free text. Neither "Request Review" nor "Get Free Review" may exist verbatim as a preset. Pick whichever preset reads most naturally next to each headline when you're actually looking at the dropdown, rather than guessing here; this doesn't change the strategy, only which exact button label is available.

## 7. Lead Gen Form (build once, attach to both ads)

Per campaign doc §7:

- **Form name:** Free Website Review
- **Headline:** Get Your Free Website Review
- **Details / supporting copy:** We'll look at your website and point out the biggest opportunities to improve clarity, conversion and the path from visitor to enquiry.
- **Fields (4):** First name, Work email, Company name, Company website
- **Custom question:** "What would you most like to improve about your website?" — multiple choice, single select: Generate more enquiries / Improve conversion / Improve design / Improve messaging / I'm not sure
- **CTA button:** Request Review (or the closest preset LinkedIn offers on the form itself, which may differ from the ad-unit CTA dropdown)
- **Confirmation message (thank-you screen):** "Thanks, your website review request has been received. We'll review your website and get back to you within 48 hours with our initial findings."
- **Privacy policy link:** required by LinkedIn for every Lead Gen Form — link to `https://halostrategic.com/privacy-policy`

Don't add extra fields beyond these four plus the one custom question. Every additional field is friction the campaign doc's optimisation rules (§9) explicitly warn against introducing without a reason.

## 8. Lead sync

Before launch, decide how leads reach you: LinkedIn's native download (CSV, manual pull from Campaign Manager) is the minimum viable option for a 20-day, £200 test and needs nothing extra to set up. LinkedIn also supports direct CRM integrations and Zapier-style webhooks if you want leads to arrive somewhere automatically, not required for a test this size, worth considering only if this scales past the first test. Whichever you choose, every lead still needs to be logged in `content/ads/linkedin-website-review/qualified-lead-tracker.xlsx` (Leads tab) by hand or by import, since that tracker, not LinkedIn, is what actually answers "is this working."

## 9. Conversion tracking (optional but recommended)

If Halo's Google Tag Manager container (`docs/GOOGLE_TAG_MANAGER.md`) already fires on `/thank-you` or a similar confirmation event, consider adding the LinkedIn Insight Tag to the site and setting up a conversion action for "Website Review Requested," so LinkedIn's own reporting can eventually show conversion data beyond form-fills. Not required to launch the test; flagging it as a genuine gap if this campaign scales, since right now conversion-quality signal only exists in the qualified-lead tracker, not in Campaign Manager itself.

## 10. Before hitting launch

- [ ] Final PNGs re-rendered with real fonts (see top of this doc), not the sandbox test renders
- [ ] Audience estimate checked, not just entered blind (§3)
- [ ] Both ads attached to the same Lead Gen Form, not two separate forms
- [ ] Confirmation message reads exactly as in §7, "48 hours," not "48 business hours"
- [ ] Privacy policy link added to the form
- [ ] Daily budget set to £10, not a higher default LinkedIn may suggest
- [ ] `qualified-lead-tracker.xlsx` open and ready to log the first lead the moment one arrives

## 11. First 48 hours

Per campaign doc §9: don't change anything (audience, bids, creative) before 48 hours have passed, regardless of how the numbers look early. Then start reading Impressions/CTR/Clicks/Form opens/Leads against the diagnostic questions already in §9 of the campaign doc, not against instinct.

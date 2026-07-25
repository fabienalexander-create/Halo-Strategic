# Halo Strategic — Site Reconciliation Report (Sprint 0)

Date: 2026-07-25
Scope: halostrategic.com, live site as currently deployed, crawled page by page and compared against work from the previous session (index.html, selected-engagements.html) plus first-time review of pages not touched before.

No changes have been made to the live site. This is findings only.

## Headline finding

The live site is currently three inconsistent templates stitched together, not one site. Six pages checked split into three distinct nav/footer families that don't match each other:

**Family A**, newest and most developed: `index.html`, `commercial-diagnostic.html`, `commercial-audit.html`, `contact.html`. Consistent nav (How Halo Works / Services / Commercial Audit / Evidence / About) and footer across all four. This is real, substantial work: a live £3,000 Commercial Audit offer, a full FAQ, a four-week process breakdown, a Diagnostic-vs-Audit comparison table. None of this existed when I last worked on the site.

**Family B**: `selected-engagements.html`, `how-halo-thinks.html`. Consistent nav (How Halo Works / Services / How Halo Thinks / Selected Engagements / About), different from Family A. This is the content from the previous session, six real Growth Stories plus the Nine Principles page.

**Family C**: `about.html`, on its own. Nav shows Case Studies / Insights (matching neither A nor B). Footer Privacy and Terms links point to `#`, dead. Footer brand line reads "© 2026 Halo." instead of "© 2026 Halo Strategic." No Cookie Policy or LinkedIn link, unlike every other page.

None of the three families link to each other reliably. Family A's nav has no link to Selected Engagements or How Halo Thinks anywhere. Family B and C don't link to the Commercial Audit or Commercial Diagnostic pages, Family A's flagship offer.

## Regression from previous work

The homepage's two Case Study cards ("From Reacting to Leading", "The Data That Was Never Missing") link to `#`, unresolved. This is the same broken-link issue fixed last session, now back, because the homepage itself was replaced with new copy that didn't carry the fix forward. Both stories already exist in full on `selected-engagements.html` with anchor IDs already in place (`#reacting-to-leading`, `#data-never-missing`) from the earlier fix, so resolving this is a one-line change per card, not new work.

The Evidence Grid and Statistics section built last session (four real numbers: 14→1, 43%, 3→6-8, ~25%) is gone from the current homepage. In its place is two paragraphs of general text under an "Evidence" heading with no concrete numbers and no link out to Selected Engagements.

## Content that exists only on the live site (not something I built)

- Commercial Diagnostic page: free/paid service split, full explanation, comparison table against the Audit.
- Commercial Audit page: £3,000 fixed-fee flagship offer, six Commercial Leak constraint areas, deliverables table, four-week process, FAQ.
- Contact page: working form, general enquiries and founder-direct email routes, LinkedIn link.
- About page: full founder bio for Fabien Alexander (agency founder, carpet and flooring business owner, Head of Marketing & Business Development at Nordic Markets), four core beliefs, "What Halo Is Not" section.

This is a substantial, coherent piece of work. It reads as deliberate, not accidental, most likely built or commissioned separately from this session's work.

## Content that exists only in the previous version (not currently linked from Family A)

- Selected Engagements: six real, evidenced Growth Stories with anchor IDs.
- How Halo Thinks: nine commercial principles.
- The Evidence Grid / Statistics block on the homepage.

## Broken or placeholder links found

- Homepage: both Case Study card links (`#`).
- About page: footer Privacy link (`#`), footer Terms link (`#`).

## Recommendation

Family A should be canonical for site-wide nav and footer. It's the newest, most commercially complete work, and it's what any paid traffic arriving next week will land on first via the Commercial Audit and Diagnostic pages. Family B's content (Selected Engagements, How Halo Thinks) is real and valuable and should be folded in, not discarded, its nav/footer updated to match Family A, and both pages added to Family A's nav. About page should be rebuilt onto Family A's nav/footer template, keeping its own real founder content, which is good and shouldn't change.

## Proposed merge plan (not yet executed)

1. Fix the two homepage Case Study card links to point at the real, already-anchored stories on Selected Engagements.
2. Add "Selected Engagements" and "How Halo Thinks" to Family A's shared nav and footer (all four pages), so the whole site is reachable from anywhere.
3. Update Selected Engagements and How Halo Thinks to Family A's nav/footer (adds Commercial Audit, Commercial Diagnostic, Cookie Policy, LinkedIn, email, which they're currently missing).
4. Fix About page's dead Privacy/Terms links and bring it onto the Family A nav/footer template. Keep all existing founder content as is.
5. Replace the homepage's thin "Evidence" paragraph with a version that references the real Evidence Grid numbers and links directly to Selected Engagements, rather than trying to summarise six stories in two sentences.
6. Leave commercial-diagnostic.html, commercial-audit.html, contact.html content untouched, only nav/footer additions, since the core content on those pages is strong as is.

Nothing above has been implemented. Once you confirm this plan (or amend it), I'll make the changes, push them as one reviewable commit, and only then start Sprint 1 (Technical SEO).

## Not yet crawled

privacy-policy.html, cookie-policy.html, terms-and-conditions.html, thank-you.html, 404.html. Lower priority (legal/utility pages), will fold into the Sprint 1 technical audit rather than this reconciliation pass unless you want them checked now.

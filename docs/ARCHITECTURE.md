# Halo Strategic — Architecture

Status: Living Document
Owner: Claude Cowork
Maintainer: Claude Cowork
Last Updated: 2026-07-26
Version: 1.0

## Purpose

This is the long-term technical architecture for halostrategic.com: the blueprint that implementation works against, not implementation guidance itself. Implementation method lives in docs/IMPLEMENTATION_GUIDE.md (Browser-owned). Current build status lives in docs/CURRENT_SPRINT.md and docs/PROJECT_CONTEXT.md (Browser-owned). This document changes only when the architecture itself changes, not when a sprint completes.

Halo's visual design system (palette, type, component patterns) is governed by the existing Design Bible v1.0 and UX Pattern Library v1.0. This document does not restate that system, it references it. Where the live site's CSS diverges from the Design Bible, that is an implementation gap to flag to Browser, not a reason to redefine design tokens here.

## Information Architecture

Verified current sitemap (12 live pages, confirmed by direct inspection of the repository at commit 7c7dbc0):

```
halostrategic.com
├── / (index.html)
├── /commercial-diagnostic.html
├── /commercial-audit.html
├── /selected-engagements.html      (6 Growth Stories, anchor-linkable)
├── /how-halo-thinks.html           (9 principles)
├── /about.html
├── /contact.html
├── /privacy-policy.html
├── /cookie-policy.html
├── /terms-and-conditions.html
├── /thank-you.html
└── /404.html
```

This matches docs/SITE_ARCHITECTURE.md, which remains the authoritative interim reference for Sprint 0's specific reconciliation work. This document supersedes it only where the two would conflict; today they agree.

**Insights exists as of 2026-07-26** (`/insights/` index, first article at `/insights/every-department-can-be-doing-its-job-well`). Three sections remain planned but do not exist yet. In priority order:

1. ~~**Insights**~~ — done, see above and the Folder Structure and Future Scalability sections below for how it was actually built.
2. **Framework Library**. Not a new top-level nav item. Scoped as an expansion of `/how-halo-thinks`, since that page already holds Halo's distilled principles. The six Halo IP ideas from the Operating Manual (Decision Leadership Over Execution, Second Pair of Eyes Not an Oracle, the Confidence Ledger, Translation Over Access, Price the Risk You Actually Carry, the Feedback-Loop Gate) belong here, each as its own page, linking out to the Selected Engagements stories that evidence them.
3. **FAQ Hub**. Not yet justified. Commercial Audit already carries a page-level FAQ. Centralise only once FAQs exist across multiple services worth consolidating.
4. **Resources**. Lowest priority. Holds downloadable material once a real lead-magnet strategy and email nurture sequence exist to route them into. Do not build lead magnets ahead of that sequence.

**Nav order implemented 2026-07-26:** How Halo Works · Services · Commercial Audit · Insights · Selected Engagements · How Halo Thinks · About, matching the order suggested here before Insights existed. Framework Library and FAQ Hub stay nested rather than adding top-level items; a nav with eight or nine top-level links stops being usable.

## URL Philosophy

**Current state (as implemented, 2026-07-26, ADR-008):** flat, extensionless, static paths — `/about`, `/commercial-audit` — served from a static file structure with no routing layer. Internal links, canonical tags, and `og:url`/`twitter` references use the extensionless, root-relative form (`/about`, not `about.html` or `/about.html`) across all 12 pages.

**How this became possible without a routing layer:** Netlify's default behaviour already serves any `page.html` file at both `/page.html` and `/page` (a "pretty URL" feature enabled by default, not something this repository configured). Direct testing of the live site confirmed both forms returned `200 OK` with no redirect between them prior to this decision, that was the actual duplicate-content exposure ADR-008 closes, not a hypothetical one. A `_redirects` file at the repository root now 301s every legacy `.html` path to its extensionless equivalent, so anything that already links to or has indexed a `.html` URL still resolves correctly.

**History:** Before Sprint 0, `how-halo-thinks.html` and `selected-engagements.html` briefly used extensionless links while the rest of the site used `.html`; Sprint 0 corrected them to match the (then-canonical) `.html` convention for consistency. That correction is now superseded by ADR-008 in the other direction, everything is extensionless again, this time site-wide and intentional rather than an inconsistency to fix.

**Resolved dependency:** the hosting/deployment mechanism this decision depended on is now confirmed (`docs/ARCHITECTURAL_DECISIONS.md`, resolved 2026-07-26): Cloudflare proxies to Netlify, and GitHub pushes trigger deploys. The `_redirects` file format used here is Netlify-specific, consistent with that confirmed hosting model.

**Applies going forward:** any future page, including Insights (`/insights/[slug]`), should be built extensionless from the start per this ADR. No further URL migration should be needed.

## Navigation Philosophy

One navigation and footer, shared across every page, is the standing rule established by Sprint 0's reconciliation (docs/RECONCILIATION_REPORT.md, docs/CHANGELOG.md) and confirmed live: How Halo Works · Services · Commercial Audit · How Halo Thinks · Selected Engagements · About, plus a persistent "Start with a Commercial Diagnostic" CTA.

Verified gap: `terms-and-conditions.html` and `404.html` still carry the pre-Sprint-0 five-item nav (missing How Halo Thinks and Selected Engagements) and the pre-Sprint-0 footer sitemap. This is a real, current implementation gap, not a documentation error, confirmed by direct inspection of both files at commit 7c7dbc0. It belongs in Sprint 1 or a small follow-up, not as an architectural question, since the target state is already decided: bring both onto the same shared nav/footer as the other ten pages.

Footer carries the same sitemap as the nav plus Contact & Legal (Contact, LinkedIn, email, Privacy Policy, Cookie Policy, Terms & Conditions). No second destination for content already reachable elsewhere (the homepage Evidence section links directly to Selected Engagements rather than adding a redundant nav item, per Sprint 0's explicit decision).

## Internal Linking Philosophy

Every page should link to at least one adjacent page in the client's decision path (Diagnostic ↔ Audit ↔ Selected Engagements ↔ How Halo Thinks ↔ About), so no page is a dead end. This is implemented and verified: Commercial Audit links to Selected Engagements and About; About links to How Halo Thinks and Selected Engagements and Commercial Audit; Selected Engagements links to Commercial Audit and Commercial Diagnostic; How Halo Thinks links to Commercial Diagnostic and Selected Engagements.

Case study references on the homepage link to specific anchored sections on Selected Engagements (`selected-engagements.html#reacting-to-leading`, `#data-never-missing`) rather than to the top of the page. This anchor-linking pattern should extend to any future page that references a specific Growth Story, rather than sending traffic to the top of a six-story page.

## Content Architecture

Selected Engagements holds six real, evidenced Growth Stories, each with a stable anchor ID (`market-too-small`, `sales-follow-up`, `reporting-not-dashboards`, `platform-instability`, `reacting-to-leading`, `data-never-missing`). These IDs are load-bearing: other pages link to them directly. Any future edit to selected-engagements.html must preserve existing anchor IDs or update every inbound link across the site.

How Halo Thinks holds nine commercial principles, framed as an observed pattern distilled from a decade of work, not a proprietary method. This is a deliberate positioning choice already made; restating it in service copy elsewhere should stay consistent with that framing rather than drift toward "our methodology."

Content ownership: page copy is not something this document governs. Copy decisions belong to Fabien and whatever process produced the current pages. This document governs structure, not words.

## Schema Philosophy

**Current state: no structured data exists anywhere on the site.** Verified by direct inspection of ten of twelve pages' full source; zero `<script type="application/ld+json">` blocks found on any page checked, including commercial-audit.html, which has a real FAQ built with `<details>/<summary>` and would be a natural FAQPage schema candidate.

**Pending Product Owner approval**, recommended priority order once approved:

1. **Organization** schema, site-wide (name, logo, sameAs LinkedIn, contact point). Lowest risk, highest baseline value, belongs in a shared header/footer include so it appears identically everywhere.
2. **LocalBusiness** (or ProfessionalService), if Halo has a registered business address it's comfortable publishing. Do not invent an address or omit this field silently; if no address is approved for publication, use Organization only.
3. **FAQPage** on commercial-audit.html, generated directly from the existing `<details>` FAQ markup so the visible content and the structured data never drift apart.
4. **Article**, deferred until Insights exists. Do not add Article schema to Selected Engagements stories; they are case studies, not articles, and forcing Article schema onto them risks a content-type mismatch Google's guidelines specifically warn against.

## Analytics Architecture

Google Tag Manager (`GTM-T49HRT6J`) is the base layer, confirmed installed and firing correctly on: index.html, about.html, how-halo-thinks.html, selected-engagements.html, privacy-policy.html (direct source inspection). docs/GOOGLE_TAG_MANAGER.md additionally claims installation on contact.html, commercial-diagnostic.html, commercial-audit.html, cookie-policy.html, thank-you.html; these five were not independently re-verified in this architecture pass and should be spot-checked in the next SEO status update rather than assumed. Confirmed **not** installed on terms-and-conditions.html or 404.html.

GA4 (`G-KC0RH0SS1L`) is configured inside the GTM container as the single measurement layer. The architecture is intentionally additive: Google Ads Conversion/Remarketing, LinkedIn Insight Tag, Microsoft Clarity, Meta Pixel, and a cookie consent tool can be added later as new tags/triggers inside the existing container without further code changes to the site. This is the correct pattern; do not introduce a second tag manager or a second GA property later without an ADR explaining why the single-container model stopped working.

Seven Consultancy Events (discovery_call_started, discovery_call_booked, commercial_diagnostic_requested, commercial_audit_requested, contact_form_submitted, email_clicked, phone_clicked) plus linkedin_clicked are defined but not yet built as GTM triggers. `phone_clicked` currently has no `tel:` link on the site to fire on, that is a content gap, not a tagging gap, and should be resolved (add a `tel:` link somewhere reachable) before that trigger is built.

## Folder Structure

Flat repository root: every root-level HTML page, every static asset (icons, manifest, one portrait image), and a `docs/` directory holding all documentation. No `src/`, `assets/`, or `build/` separation exists at the root. Pages were documented as generated through a shared Python template system (`common.py` plus one build script per page); as of 2026-07-26 that tooling could not be located anywhere in this repository's history or in related local locations searched (see docs/ARCHITECTURAL_DECISIONS.md, ADR-001 Amendment). Until it is located or rebuilt, treat every HTML file as directly maintained, with shared elements (header, footer, `<style>` block) kept consistent by hand across pages rather than by a generator.

**Insights folder, added 2026-07-26:** the flat-vs-folder question this section used to pose hypothetically is now answered by necessity, one real `insights/` subdirectory exists, containing `index.html` and one article file per slug (`insights/every-department-can-be-doing-its-job-well.html`), the folder-per-article option this document already named as a possibility. This is not a templating solution, each file is still a full standalone copy of the shared head/nav/footer boilerplate, hand-maintained exactly like every root-level page. It answers "where do files live," not "how do we avoid copying the boilerplate 100 times." That second question is unchanged and unresolved, see Future Scalability below.

## Future Scalability

The current architecture is a static site with no server-side logic, no database, and no CMS. This is a legitimate, deliberate choice for a twelve-page consultancy site with infrequent content changes made by one person. It stops being appropriate at the point where:

- Insights needs frequent, non-technical publishing (a CMS or a lightweight markdown-to-HTML pipeline becomes justified).
- The business needs authenticated content (client portals, gated resources) that a static site cannot serve without a backend.
- Multiple people need to publish without going through a Python build script.

None of these thresholds have been reached. Do not add a CMS, database, or backend framework speculatively. When one of the above triggers becomes real, that decision should be recorded as an ADR in docs/ARCHITECTURAL_DECISIONS.md, evaluated against the specific need at the time, not decided in the abstract now.

Three specific scaling risks are worth documenting now, before Insights is built, rather than discovering them after:

- **Resolved 2026-07-26, ADR-009.** Article #1 was published by hand-copying the shared boilerplate, exactly the risk this section flagged. Before article #2, a local generator was built: `tools/insights-article-template.html` and `tools/insights-index-template.html` hold the shared boilerplate once with `{{TOKEN}}` placeholders, `tools/insights-articles.json` holds per-article data, and `tools/build-insights.js` generates the actual `insights/*.html` files, which are then committed normally. Verified byte-for-byte identical output when regenerating the two already-published pages from the new system, confirming zero regression. This is a generator, not a CMS or a Netlify-side build step, see ADR-009 for what it does and deliberately does not solve (non-technical publishing remains unaddressed, and the 12 root-level pages remain hand-maintained, unifying the two approaches is a separate, not-yet-made decision).
- **The shared Open Graph image (docs/TECHNICAL_SEO.md, finding 5) gets worse at scale, not better.** Twelve pages sharing one generic social-share image is a minor finding. A hundred Insights articles sharing that same image means every article shared on LinkedIn looks identical in-feed, which actively undermines an authority-content strategy. Page-specific OG images (even programmatically generated ones) should be resolved before Insights launches, not after a large content backlog exists to retrofit.
- **Selected Engagements' single-page-with-anchors pattern has a ceiling.** At six Growth Stories, one long page with anchor IDs per story is the right pattern, it's easy to skim and cheap to maintain. It will not remain the right pattern indefinitely; loading dozens of full case studies on every visit to read one story is a page-weight problem waiting to happen. No threshold is proposed here since six is nowhere near it, but if Selected Engagements grows past roughly 15-20 stories, revisit whether it should become one-story-per-page with the anchor page as an index, rather than assuming the current pattern scales without limit.

## Design Principles

These are the standing rules that keep this architecture from drifting, not new invention:

- **One template system, not per-page hand-editing — intended, currently unenforceable.** The intent is that any shared change (a new nav item, a footer update) is a one-file edit to `common.py`, not seven edits across seven files; that is exactly what would prevent the Sprint 0 regression from recurring (three inconsistent nav/footer families accumulated from per-page hand-editing, per docs/RECONCILIATION_REPORT.md). As of 2026-07-26, `common.py` could not be located (see docs/ARCHITECTURAL_DECISIONS.md, ADR-001 Amendment), so this protection does not currently exist mechanically. Until it does, shared changes must be made by hand across every affected file, with explicit verification that all pages stayed in sync.
- **The repository is the implementation source of truth. The live site is the verification source of truth.** Neither is assumed to match the other without checking. This architecture document was itself corrected mid-draft after an initial check against a stale CDN-cached copy of the repository produced false findings; the lesson holds for every future audit, always verify against a pinned commit or the live site, never trust a branch-alias fetch without cross-checking.
- **No content rewritten as a side effect of structural work.** Sprint 0 changed navigation, footer, and internal linking only; page copy was untouched. Future structural sprints should hold the same line, structural change and content change are different approvals.
- **Anchor IDs are contracts.** Once a page is linked to by anchor ID from elsewhere on the site, that ID cannot move without updating every inbound link.

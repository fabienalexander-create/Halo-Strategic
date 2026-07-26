# Changelog

## 2026-07-26 — Documentation Correction: Build System Verification

Corrected documentation that described a Python template system (`common.py`, `site/gtm_snippets.py`) as the site's build mechanism. A full search of this repository's git history plus related local locations (halo-site-package.zip, .openclaw workspace, Documents, Downloads) found no such tooling anywhere. Amended ADR-001 and ADR-005 (docs/ARCHITECTURAL_DECISIONS.md) with dated notes rather than creating a new ADR, since the underlying design decisions are unchanged, only their implementation status was disproven. Corrected docs/PROJECT_CONTEXT.md and docs/ARCHITECTURE.md to describe directly-maintained HTML as the verified current state. Appended a note to docs/GOOGLE_TAG_MANAGER.md and corrected a stale line in docs/TECHNICAL_SEO_STATUS.md. No HTML, CSS, or site behaviour changed; documentation only. See docs/IMPLEMENTATION_LOG.md for full detail.

## 2026-07-25 — Sprint 0: Site Reconciliation

Unified three inconsistent page templates (see `docs/RECONCILIATION_REPORT.md`) into one canonical design system across every page.

- Standardised navigation and footer across index.html, about.html, contact.html, commercial-diagnostic.html, commercial-audit.html, how-halo-thinks.html, selected-engagements.html.
- Added "How Halo Thinks" and "Selected Engagements" to the main nav and footer sitemap on every page, previously only reachable from each other, not from the homepage or service pages.
- Fixed the homepage's two Case Study card links, previously `href="#"`, now point to `selected-engagements.html#reacting-to-leading` and `#data-never-missing`.
- Rebuilt how-halo-thinks.html and selected-engagements.html onto the shared stylesheet and component system (previously a separate, standalone CSS file per page). Content unchanged, all six Growth Stories and nine principles preserved verbatim, including existing anchor IDs.
- Rebuilt the homepage Evidence section with four real, sourced numbers (14→1, 43%, 3→6-8, ~25%) and a direct link to Selected Engagements, replacing two generic paragraphs with no numbers.
- Added internal links per the approved merge plan: Commercial Audit → Selected Engagements, Commercial Audit → About, About → How Halo Thinks, Selected Engagements → Commercial Audit, How Halo Thinks → Commercial Diagnostic, plus several supporting cross-links (Contact → About, How Halo Works → How Halo Thinks, Services cards → Diagnostic/Audit).
- Renamed a class collision: about.html's paragraph-spacing wrapper was `.story` (same name, different meaning, as selected-engagements.html's article-card wrapper). Renamed to `.founder-story` on about.html only, no visual change.
- No content was rewritten. Commercial Diagnostic, Commercial Audit, Contact, About, Selected Engagements, and How Halo Thinks all keep their existing copy exactly as written.

Not done in this sprint (see `docs/SITE_ARCHITECTURE.md` for where these fit): Insights hub, Framework Library, FAQ Hub, Resources. Sprint 1 (Technical SEO) starts next.


## 2026-07-25 - Sprint 1A: Google Tag Manager Installation (backfilled 2026-07-26)

Note: this entry was not written when commit 4d9503e was made. It is backfilled during Phase 3 Documentation Reconciliation, reconstructed from docs/GOOGLE_TAG_MANAGER.md and the commit diff, not invented.

Installed Google Tag Manager container GTM-T49HRT6J across 10 of 12 pages: index.html, about.html, contact.html, commercial-diagnostic.html, commercial-audit.html, how-halo-thinks.html, selected-engagements.html, privacy-policy.html, cookie-policy.html, and thank-you.html. terms-and-conditions.html and 404.html were not yet on the unified template at that point and were left out of scope. Added the standard head script and body noscript iframe snippet, generated from a single shared source (site/gtm_snippets.py) so every page received an identical, correctly placed install. Left the existing GA4 configuration tag (GA4, Configuration, Halo Strategic, Measurement ID G-KC0RH0SS1L) and DOM, Page Title variable in place, both already built in the container prior to this pass. Rewrote privacy-policy.html and cookie-policy.html to accurately describe GA4/GTM use and its cookies, since both pages previously stated no analytics or tracking was in use. Did not build the seven Consultancy Events triggers or the eighth, linkedin_clicked; deferred as a scoped follow-up. See docs/GOOGLE_TAG_MANAGER.md.

## 2026-07-25 - Sprint 1B: Service Parameter Plumbing and Mailto Links (backfilled 2026-07-26)

Note: this entry was not written when commit f6bb162 was made. It is backfilled during Phase 3 Documentation Reconciliation, reconstructed from the commit diff, not invented.

Added service query parameters (diagnostic, audit) to the primary CTA links on commercial-diagnostic.html and commercial-audit.html. Added a hidden service form field on contact.html and index.html, populated from the URL parameter via inline JS on contact.html, and set statically to diagnostic on index.html, so submissions carry which service page a lead arrived from. On contact.html, defaulted the reason dropdown to discovery call when a service parameter is present and no reason has been chosen yet. Added a form_submit_success dataLayer push, with form_id, service, and reason, on both contact.html and index.html, firing only after a successful submission, for GTM/GA4 measurement. Converted the two contact.html email addresses to mailto links.

## 2026-07-26 - Architecture, ADRs, Technical SEO Audit, and Roadmap Approved (Cowork)

Claude Cowork committed docs/ARCHITECTURE.md, docs/ARCHITECTURAL_DECISIONS.md, docs/TECHNICAL_SEO.md, and docs/ROADMAP.md, commit ee3caf6, completing Cowork's architectural responsibilities per docs/AI_OPERATING_MODEL.md. These are now the approved architectural source of truth. This entry logs their arrival for the chronological record; their content is Cowork-owned and is not restated or edited here.

## 2026-07-26 - Phase 3: Documentation Reconciliation

Reconciled Browser-owned implementation documentation against the newly approved architecture, commit ee3caf6. docs/CURRENT_SPRINT.md: corrected the Sprint 1 blocker, since the audit now exists and docs/ROADMAP.md scopes URL strategy to Sprint 2 rather than Sprint 1, added the Sprint 1A/Sprint 1B historical entries and a numbering note, and split remaining Sprint 1 scope into ready, partially blocked (schema), and out of scope (URL strategy, Sprint 2). docs/PROJECT_CONTEXT.md: removed references describing docs/ARCHITECTURE.md, docs/ARCHITECTURAL_DECISIONS.md, docs/ROADMAP.md, and docs/TECHNICAL_SEO.md as placeholders, and resolved the open item asking whether a Technical SEO audit exists. docs/TECHNICAL_SEO_STATUS.md: populated the status table against all 13 docs/TECHNICAL_SEO.md findings, reflecting that findings 7 and 8, GTM and nav/footer coverage, are partially implemented (10 of 12 pages) rather than not started. docs/IMPLEMENTATION_LOG.md: backfilled the Sprint 1A and Sprint 1B entries that were missing at the time those changes were committed. No Cowork-owned document was modified. No site code was changed in this pass; this is a documentation-only commit.

## 2026-07-26 - Sprint 2: URL Strategy Resolved, Extensionless Site-Wide

Decided and implemented extensionless URLs (docs/ARCHITECTURAL_DECISIONS.md ADR-008), after live-site testing found `/about` and `/about.html` both resolving with no redirect between them, an unconfigured Netlify default colliding with the site's all-`.html` codebase. Updated every internal link, canonical tag, and og:url across all 12 pages to the extensionless form (`/about`, `/`, including anchors). Added a `_redirects` file 301ing every legacy `.html` path to its extensionless equivalent (404.html excluded intentionally). Resolves Sprint 2's blocking dependency; sitemap.xml, robots.txt, favicon/manifest consistency, and Core Web Vitals baseline are no longer blocked. See docs/IMPLEMENTATION_LOG.md for full verification detail.

## 2026-07-26 - Phase 1 SEO Sprint: Mechanical Fixes and Title/Meta Updates

Mechanical, decision-free fixes from the full 12-page reality audit: removed a duplicate nav `active`-class bug on index.html and contact.html, fixed two h2->h4 heading skips (commercial-diagnostic.html, commercial-audit.html), fixed contact.html's H1->H3 skip by promoting four card headings to h2, and escaped a literal `&` to `&amp;` in terms-and-conditions.html's title/OG tags. Separately, after a proposal round, implemented title tag and meta description updates on 5 of 12 pages: index.html and about.html titles reordered keyword-first; contact.html title changed to reflect actual intent; meta descriptions rewritten into the 150-160 character target on commercial-diagnostic.html, commercial-audit.html, and contact.html. How Halo Thinks and Selected Engagements deliberately left untouched to protect their existing branded framing from generic keyword-forcing. Legal/utility pages untouched, no meaningful keyword target exists. Broken OG image, LocalBusiness schema, and sitemap/robots.txt remain logged as deferred, not worked around. See docs/IMPLEMENTATION_LOG.md.

## 2026-07-26 - Sprint 1: Nav/Footer/GTM Parity on terms-and-conditions.html and 404.html

Brought the two remaining lagging pages onto the same nav, footer Sitemap, and GTM baseline as the other 10 pages, closing docs/TECHNICAL_SEO.md findings 7 and 8 (now 12 of 12 pages on both). Added the GTM head script and noscript block (previously entirely absent on both pages). Replaced the stale 5-item nav (missing How Halo Thinks and Selected Engagements, with a dead `index.html#insights` Evidence link) and the stale footer Sitemap list (same two items missing, with a dead `index.html#case-studies` link) with the current 6-item nav and 7-item footer Sitemap used everywhere else. No page content, scripts, or CSS changed on either page. See docs/IMPLEMENTATION_LOG.md for verification detail.

## 2026-07-26 - Sprint 1: Audit-Coverage Closure on cookie-policy.html and thank-you.html

Closed docs/TECHNICAL_SEO.md finding 13, both pages source-inspected directly for the first time. Both were already fully compliant, correct GTM, nav, footer Sitemap, and meta tags, no remediation needed. This completes Sprint 1's non-schema scope; schema (Organization, FAQPage) remains pending Product Owner approval. See docs/IMPLEMENTATION_LOG.md for verification detail.

## 2026-07-26 - Header UX: Logo Size/Spacing Increase, Fixing a Newly Discovered Logo Inconsistency

Increased logo presence per Fabien's request: icon 24px to 28px, logo text 1.15rem to 1.35rem (both +~17%, within the requested 15-25% range), more icon-to-text gap and header vertical padding, and a tightened nav-links gap to compensate. While preparing this, discovered the site was not actually visually consistent beforehand: 5 pages (privacy-policy, cookie-policy, terms-and-conditions, thank-you, 404, the same pages Sprint 0 never crawled) had a plain text logo with no icon, while the other 7 already carried an SVG icon mark. Brought the 5 onto the same icon+text treatment as the other 7, consistent with ADR-002's precedent of extending the more-developed treatment rather than reducing to the lesser one. Nav-item restructuring was explicitly not done, today's 6-item nav isn't overloaded and the pages that would justify restructuring (Insights, Framework Library) don't exist yet; see docs/IMPLEMENTATION_LOG.md for the flagged discrepancy between casual guidance and docs/ARCHITECTURE.md's existing approved IA on where Framework Library should nest.

## 2026-07-26 - Sprint 1: Schema Rollout, Organization Site-Wide and FAQPage on commercial-audit.html

Closed docs/TECHNICAL_SEO.md finding 6, approved by Fabien and recorded as docs/ARCHITECTURAL_DECISIONS.md ADR-007. Added an identical Organization JSON-LD block (name, url, logo, sameAs LinkedIn, contactPoint email) to all 12 pages. Added an FAQPage JSON-LD block to commercial-audit.html, generated from and matching its five visible FAQ entries verbatim. LocalBusiness and Article schema remain deferred, per docs/ARCHITECTURE.md's original recommendation, no business address is available to publish and Insights doesn't exist yet. This completes Sprint 1 in full. See docs/IMPLEMENTATION_LOG.md for verification detail.

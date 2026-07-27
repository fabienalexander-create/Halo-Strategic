# Changelog

## 2026-07-27 — Product journey restructured: Clarity → Strategy → Transformation → Partnership (ADR-014)

Restructured the 6-stage/14-product model into 4 stages/5 products: Clarity (Health Check, Diagnostic), Strategy (Audit), Transformation (one flexible project, replacing five separately-named products), Partnership (one relationship, replacing four). "Implementation" renamed "Commercial Transformation" throughout. Added the governing sentence to `/product-journey`: "Not every client needs a Commercial Audit... not every Transformation requires an ongoing Strategic Partnership." `commercial-diagnostic.html` updated with a 90-minute session length and outcome-focused deliverables. **Every displayed price is unchanged** ($995 Diagnostic, $7,500+ Audit), a deliberate decision to separate positioning from pricing; pricing gets revisited after real prospect conversations, not in this pass. `docs/PRODUCT_SYSTEM.md`, `docs/PRODUCT_POSITIONING.md` rewritten; `docs/HALO_BIBLE.md` Section Ten carries a dated amendment (frozen document, no silent rewrite). See ADR-014.

## 2026-07-27 — Roadmap library started: CRM & Enquiry Automation

New `docs/roadmap/` folder, a library of future-capability design documents deliberately not scheduled into current sprints. First entry: `CRM_AUTOMATION_ROADMAP.md`, a 7-phase plan (manual workflow through CRM, email automation, AI enquiry briefs, founder dashboard, proposal generation, knowledge base). Planning only, explicitly deferred, Phase 1 (Netlify Forms → email → Fabien, manual) is the only phase currently live. No implementation without a document being explicitly pulled out and scheduled. See `docs/roadmap/README.md`.

## 2026-07-26 — Logo sizing increase and brand asset cleanup (ADR-013)

Header icon increased 28px → 36px (wordmark and gap unchanged, per Fabien's correction after the original instruction's baseline didn't match the live CSS). Fixed two mislabeled asset files (`halo-icon-light.svg`, `halo-lockup-light.svg` both contained navy colours despite their names) and replaced a corrupted `halo-lockup-navy.svg` (actually a 1.69MB PNG with embedded C2PA metadata, not a valid SVG) with a clean regenerated version. Every page's inline header/footer logo SVG replaced with `<img>` references to the canonical asset files, explicit width/height attributes to prevent layout shift. See docs/ARCHITECTURAL_DECISIONS.md (ADR-013).

## 2026-07-26 — Halo Bible v1.0 frozen (ADR-012)

Compiled all ten Bible sections, previously scattered across scratchpad files, into `docs/HALO_BIBLE.md` and committed it to the repo as Halo's constitutional document. No casual edits going forward; changes require real client evidence and must be dated amendments. `docs/AI_OPERATING_MODEL.md` updated with the document's special governance status. Caught and corrected one real staleness during compilation: the Glossary's Commercial Diagnostic/Audit entries still carried pre-Sprint-5.6 pricing. See docs/ARCHITECTURAL_DECISIONS.md (ADR-012) and docs/IMPLEMENTATION_LOG.md.

## 2026-07-26 — Sprint 5.6: Agency Partnerships (ADR-011)

New `agency-partnerships.html` at `/agency-partnerships`, built from Fabien's full feature brief, a secondary-audience B2B partnership page for marketing agencies (not competing with the core business-owner journey): hero, The Problem, A Better Way, a 5-step process, Benefits, the Halo Partner Promise, Perfect For industries, the Halo Clarity Guarantee (reused verbatim), FAQ, final CTA. Organization, Service, and FAQPage schema added. Footer-only link across all 17 pages plus one inline mention on `about.html`, deliberately kept out of the main nav per the brief. Three FAQ answers (white-label, co-branded reports, partner pricing) stated honestly as not yet available, since the brief scoped those as future-phase, not to be built now. `sitemap.xml` and `_redirects` updated. See docs/IMPLEMENTATION_LOG.md and docs/ARCHITECTURAL_DECISIONS.md (ADR-011).

## 2026-07-26 — Sprint 5.6: Live implementation (pricing, Health Check, Product Journey)

Approved directly by Fabien as Product Owner. Implemented on the live site: `commercial-diagnostic.html` repriced $0 → $995 with the Halo Clarity Guarantee added; `commercial-audit.html` repositioned from a fixed £3,000/4-week engagement to $7,500+, scope-dependent (FAQPage JSON-LD updated to match); new `pricing-config.js` (ADR-010) holds all prices as data, not hardcoded HTML, structured to support additional currencies later, none added yet since only USD prices have been approved; new `commercial-health-check.html`, a free, 6-question, client-side-scored self-assessment with no data submitted or stored; new `product-journey.html`, the full 6-stage product ecosystem, priced only where Fabien actually set prices. Nav, footer, and the nav-right CTA updated across all 16 HTML pages (Insights pages regenerated via the existing generator, not hand-edited). `sitemap.xml` and `_redirects` updated. Open items: US-market/currency positioning still undecided, guarantee refund copy is an explicit placeholder pending legal review, two products from an earlier draft (Lead Management System, Growth Board) remain unconfirmed, and every product beyond Diagnostic/Audit remains unpriced. See docs/IMPLEMENTATION_LOG.md and docs/ARCHITECTURAL_DECISIONS.md (ADR-010).

## 2026-07-26 — Sprint 5.6: Product Architecture & Commercial Positioning (documents)

Added four working documents converting the Halo Bible's philosophy into a proposed product ecosystem: `docs/PRODUCT_SYSTEM.md` (6-stage journey, 14 products, entry criteria as gates), `docs/PRODUCT_POSITIONING.md` (why the ecosystem differs from a traditional agency's service catalogue), `docs/PRICING_STRATEGY.md` (current-vs-proposed comparison for the two live products this would reprice, three sequencing options, no single recommendation forced), and `docs/GUARANTEE.md` (the Halo Clarity Guarantee, flagged as needing real legal review before publishing). None of this is implemented on the live site: Commercial Diagnostic and Commercial Audit remain live at their current free/£3,000 pricing. See docs/IMPLEMENTATION_LOG.md and docs/CURRENT_SPRINT.md for the open items each document carries forward.

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

## 2026-07-26 - Sprint 3: Article #2 Published, "How to Tell a Marketing Problem from a Commercial Problem"

Second Insights article, published via the ADR-009 generator, one JSON entry added to `tools/insights-articles.json`, `node tools/build-insights.js` run, output committed. Grounded in the sales-follow-up and market-too-small Selected Engagements case studies and the relevant How Halo Thinks principle; nothing invented. Approved by Fabien after reading a draft. Added to sitemap.xml and `_redirects`. Verified article #1 unaffected (zero diff) and the index page gained exactly one correctly-escaped new card. See docs/IMPLEMENTATION_LOG.md.

## 2026-07-26 - Sprint 3: Insights Build System (ADR-009)

Replaced hand-copying boilerplate per Insights article with a local generator: `tools/insights-article-template.html` and `tools/insights-index-template.html` hold the shared boilerplate once with token placeholders, `tools/insights-articles.json` holds per-article content, and `tools/build-insights.js` generates the actual `insights/*.html` files (run locally, output committed normally, not a Netlify-side build step). Decided in response to "decide on the build approach before article #2," and scoped deliberately to Insights only, not the 12 root-level pages. Not a CMS, doesn't enable non-technical publishing, that decision (ADR-004) remains open. Verified: regenerating both existing Insights pages produced byte-for-byte identical output to what was already published, after fixing one real HTML-escaping bug the verification caught. See docs/IMPLEMENTATION_LOG.md.

## 2026-07-26 - Sprint 3: Insights Section Stood Up, Article #1 Published

Added `insights/index.html` and `insights/every-department-can-be-doing-its-job-well.html` ("Why Every Department Can Be Doing Its Job Well and the Business Still Underperforms"), approved by Fabien after reading a draft. Added "Insights" to primary nav and footer sitemap across all 14 pages, in the position docs/ARCHITECTURE.md already specified, and reordered Selected Engagements before How Halo Thinks to match. Both new pages are extensionless (ADR-008), carry GTM and Organization schema like every other page, and are listed in sitemap.xml. Hand-authored, not templated, the same approach as every other page; the build-scaling question docs/ARCHITECTURE.md already flagged remains open before article #2. Article schema and the CMS/no-CMS decision (ADR-004) remain deliberately undecided. See docs/IMPLEMENTATION_LOG.md.

## 2026-07-26 - Sprint 2: sitemap.xml and robots.txt Added

Added sitemap.xml (10 URLs: homepage plus 9 content/legal pages, matching the site's canonical URL set exactly) and robots.txt (Allow: / for all agents, pointing to the sitemap). Excluded 404.html (error page) and thank-you.html (post-submission confirmation) from the sitemap as a standard inclusion choice, neither page's indexability was changed. See docs/IMPLEMENTATION_LOG.md.

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

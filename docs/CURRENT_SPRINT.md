# Current Sprint

Status: Living Document
Owner: Claude Browser
Maintainer: Claude Browser
Last Updated: 2026-07-26

## Sprint

Sprint 5.6 - Product Architecture & Commercial Positioning

## Status

Sprint 2 and Sprint 3 (Insights Foundation) are complete (see Completed). Sprint 5.6 has produced four working documents (docs/PRODUCT_SYSTEM.md, docs/PRODUCT_POSITIONING.md, docs/PRICING_STRATEGY.md, docs/GUARANTEE.md) converting the Halo Bible's philosophy and frameworks into a proposed 6-stage product ecosystem. Nothing from this sprint is implemented on the live site. Open items pending Fabien's decision: whether/how to reprice the currently-live free Commercial Diagnostic and fixed-£3,000 Commercial Audit, whether Halo is formally pursuing US-market positioning (the USD pricing direction implies this but doesn't decide it), two products dropped from an earlier draft (Lead Management System, Growth Board) unconfirmed as intentional, overlap between Quarterly Commercial Review and Constraint Review unresolved, and the Halo Clarity Guarantee's refund mechanics flagged as needing real legal/accounting review before publishing. The Halo Bible's foundation sections (Philosophy, Core Principles, Commercial Leakage Framework, Master Framework, Revenue Friction Map, Visual Language, Glossary) are treated as settled source of truth for this sprint and were not rewritten. Growth Maturity Model and Halo Metrics remain the two Bible sections still to be originated. Framework Library, FAQ Hub, and Resources remain correctly out of scope.

## Completed (prior sprints)

Sprint 5.6, Product Architecture & Commercial Positioning (2026-07-26): built `docs/PRODUCT_SYSTEM.md` (6-stage product hierarchy and journey map, 14 products across Discover/Investigate/Design/Implement/Optimise/Partnership), `docs/PRODUCT_POSITIONING.md` (why the ecosystem differs from a traditional agency, mapped to the Philosophy chapter by chapter), `docs/PRICING_STRATEGY.md` (current-vs-proposed comparison for the two live products, three sequencing options, no forced recommendation), and `docs/GUARANTEE.md` (Halo Clarity Guarantee copy and FAQ, flagged for legal review). Every product traces to the Leakage → Friction → Constraint → Alignment hierarchy and Halo's First Law. Approved by Fabien for commit after reviewing all four documents delivered directly. See docs/IMPLEMENTATION_LOG.md.

Sprint 3, Article #2 (2026-07-26): "How to Tell a Marketing Problem from a Commercial Problem," published via the ADR-009 generator, the first real use of it, one entry added to `tools/insights-articles.json`, `node tools/build-insights.js` run, output reviewed and committed. Grounded in the sales-follow-up and market-too-small Selected Engagements case studies and the relevant How Halo Thinks principle. Approved by Fabien after reading a draft. Verified article #1 unaffected (zero diff) and the index gained exactly one correctly-escaped new card. Added to sitemap.xml and `_redirects`. See docs/IMPLEMENTATION_LOG.md.

Sprint 3, Insights build system (2026-07-26, ADR-009): replaced hand-copying boilerplate per article with a local generator. `tools/insights-article-template.html` and `tools/insights-index-template.html` hold the shared boilerplate once with token placeholders; `tools/insights-articles.json` holds per-article data; `tools/build-insights.js` generates the actual `insights/*.html` files, run locally, output committed normally. Verified: regenerating both existing Insights pages from the new system produced byte-for-byte identical output, after fixing one real bug the verification caught (an unescaped `&` in a plain-text field, same class of bug as the terms-and-conditions.html fix earlier this session). Decided in response to "Decide on the build approach before article #2." Does not touch the 12 root-level pages, which remain hand-maintained; unifying the two is a separate, not-yet-made decision. See docs/IMPLEMENTATION_LOG.md.

Sprint 3, Insights section + Article #1 (2026-07-26): stood up `/insights` (index) and `/insights/every-department-can-be-doing-its-job-well` (first article), both extensionless from the start (ADR-008) with forced `_redirects` entries for their `.html` filenames. Added "Insights" to primary nav and footer sitemap across all 14 pages, in the position and order docs/ARCHITECTURE.md already specified, also reordering Selected Engagements before How Halo Thinks to match. Both new pages carry Organization schema and GTM, matching every other page; Article schema was not added, still deferred, a genuine decision point now that Insights is real (see docs/ROADMAP.md, Sprint 3). Article #1 approved by Fabien after reading a draft; content traces only to already-published Selected Engagements case studies, nothing invented. Added both new URLs to sitemap.xml. See docs/IMPLEMENTATION_LOG.md.

Sprint 2, sitemap.xml and robots.txt (2026-07-26): sitemap.xml added, 10 URLs (homepage plus 9 content/legal pages, matching the site's canonical URL set exactly), excluding 404.html and thank-you.html as a standard sitemap-inclusion choice (neither page's indexability was changed). robots.txt added, Allow: / for all agents, pointing to the sitemap. Verified: sitemap well-formed, 10 URLs match canonicals exactly, 3 spot-checked URLs resolve live. See docs/IMPLEMENTATION_LOG.md.

Sprint 2, URL strategy resolution (2026-07-26): decided extensionless (docs/ARCHITECTURAL_DECISIONS.md ADR-008) after a live-site test found `/about` and `/about.html` both resolving with no redirect between them, Netlify's default pretty-URL behaviour colliding with an all-`.html` codebase. Implemented same-day: every internal link, canonical tag, and og:url/twitter reference across all 12 pages updated to the extensionless form; a `_redirects` file added at the repository root 301ing every legacy `.html` path to its extensionless equivalent (404.html excluded, Netlify's error-page filename convention). Verified: no remaining internal `.html` links except 404.html's own canonical (intentional), no double slashes, all 12 titles still unique, full diff reviewed per file. See docs/IMPLEMENTATION_LOG.md, docs/ARCHITECTURE.md's URL Philosophy section, and the URL Architecture Decision Record delivered the same session.

Sprint 1, schema rollout (2026-07-26): Organization JSON-LD implemented identically on all 12 pages (name, url, logo, sameAs LinkedIn, contactPoint email); FAQPage JSON-LD implemented on commercial-audit.html, generated from and matching its five visible FAQ entries verbatim. Approved by Fabien in conversation and recorded as docs/ARCHITECTURAL_DECISIONS.md ADR-007. LocalBusiness and Article schema remain deferred per docs/ARCHITECTURE.md's original recommendation (no address to publish; Insights doesn't exist yet). Verified: all JSON-LD blocks validated as syntactically correct. See CHANGELOG.md and IMPLEMENTATION_LOG.md.

Sprint 1, audit-coverage closure on cookie-policy.html and thank-you.html (2026-07-26): both pages source-inspected directly against docs/TECHNICAL_SEO.md finding 13. Both were already fully compliant, correct GTM, nav, footer Sitemap, and meta tags, no remediation needed. Verified by diffing the nav-links, footer Sitemap, and GTM blocks byte-identical against privacy-policy.html, plus confirming the meta tag pattern (description, canonical, OG, Twitter) present on both. See CHANGELOG.md and IMPLEMENTATION_LOG.md.

Sprint 1, nav/footer/GTM parity on terms-and-conditions.html and 404.html (2026-07-26): both pages brought onto the same nav, footer Sitemap, and GTM baseline as the other 10 pages, closing docs/TECHNICAL_SEO.md findings 7 and 8. Verified by diffing the nav-links, footer Sitemap, and GTM head/noscript blocks byte-identical against privacy-policy.html's already-verified-correct blocks; no other content, scripts, or styling touched. See CHANGELOG.md and IMPLEMENTATION_LOG.md.

Sprint 0, Site Reconciliation (2026-07-25): unified three inconsistent nav/footer templates into one canonical design system across all seven main pages. See CHANGELOG.md, IMPLEMENTATION_LOG.md, RECONCILIATION_REPORT.md.

Sprint 1A, Google Tag Manager Installation (2026-07-25, commit 4d9503e): GTM container GTM-T49HRT6J installed on 10 of 12 pages, GA4 configuration tag confirmed already present, Privacy Policy and Cookie Policy analytics claims corrected to match. See GOOGLE_TAG_MANAGER.md and the backfilled entry in IMPLEMENTATION_LOG.md.

Sprint 1B, Service Parameter Plumbing and Mailto Links (2026-07-25, commit f6bb162): added service query parameters to Commercial Diagnostic and Commercial Audit CTAs, wired the parameter through to hidden form fields on contact.html and index.html, added a form_submit_success dataLayer event for GTM/GA4 measurement, and converted the two contact-page email addresses to mailto links. See the backfilled entry in IMPLEMENTATION_LOG.md.

Architecture Approved (2026-07-26, commit ee3caf6): Claude Cowork committed docs/ARCHITECTURE.md, docs/ARCHITECTURAL_DECISIONS.md, docs/TECHNICAL_SEO.md, and docs/ROADMAP.md as the approved architectural source of truth.

### A note on Sprint numbering

Sprint 1A and Sprint 1B were implemented and committed on 2026-07-25, under those labels, before this document existed (first created in commit 178d62a) and before docs/ROADMAP.md defined a formal Sprint 1 scope (commit ee3caf6). That chronology is preserved here rather than rewritten: the GTM installation and service-parameter work genuinely happened first, under a self-assigned Sprint 1A/1B label, and the formal Sprint 1, Technical SEO & Analytics scope now defined in docs/ROADMAP.md was written afterward and covers different, non-overlapping work, namely nav/footer/GTM parity on the two lagging pages plus schema. Both fall under the general Technical SEO & Analytics banner, but Sprint 1A/1B are historical, already-shipped work, while Sprint 1 in the heading above refers specifically to docs/ROADMAP.md's current definition. Future implementation tracked against docs/ROADMAP.md's Sprint 1 should not be renumbered into, or confused with, the historical Sprint 1A/1B entries above.

## In Progress

None currently logged.

## Awaiting Approval

LocalBusiness schema: deferred pending Fabien supplying a registered business address he's comfortable publishing. Not blocking anything else, see ADR-007.

## Blocked

None. Both prior Sprint 2 blockers (hosting/deployment mechanism, URL strategy) are resolved, see Completed above.

## Ready for Implementation

Sprint 2's remaining scope: favicon/manifest consistency, Core Web Vitals baseline. Neither blocked. Sprint 3's remaining scope: articles #3+ from the 100-idea backlog (98 remaining, mechanically cheap to add via `tools/build-insights.js`), Article schema, and the CMS/no-CMS decision (ADR-004, still open, unrelated to the build-scaling fix). All pending Fabien's direction.

## Next Milestone

To add article #3: add an entry to `tools/insights-articles.json`, run `node tools/build-insights.js`, review the diff, commit, same process article #2 just used successfully. Separately, favicon/manifest consistency (docs/TECHNICAL_SEO.md finding 11) and a Core Web Vitals baseline remain open from Sprint 2.

## Known Risks

Seven Consultancy Events GTM triggers (discovery_call_started, discovery_call_booked, commercial_diagnostic_requested, commercial_audit_requested, contact_form_submitted, email_clicked, phone_clicked) plus linkedin_clicked are not yet built. phone_clicked has no tel link on the site currently to fire on. GTM container has not yet been published (per GOOGLE_TAG_MANAGER.md Next item 1), awaiting Fabien to run Preview mode and Submit in tagmanager.google.com. privacy-policy.html and cookie-policy.html were rewritten to reflect GA4/GTM use; worth a final read-through once the container is published.

## Reference

See docs/IMPLEMENTATION_LOG.md, docs/GOOGLE_TAG_MANAGER.md, docs/ARCHITECTURE.md, docs/ARCHITECTURAL_DECISIONS.md, docs/ROADMAP.md, and docs/TECHNICAL_SEO.md for full detail behind each item above.

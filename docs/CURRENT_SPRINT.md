# Current Sprint

Status: Living Document
Owner: Claude Browser
Maintainer: Claude Browser
Last Updated: 2026-07-26

## Sprint

Sprint 2 - Sitemap, Robots, and URL Strategy Resolution

## Status

Sprint 1 is complete in full (see Completed). Sprint 2's blocking dependency, the URL strategy decision, is now resolved: extensionless, recorded as docs/ARCHITECTURAL_DECISIONS.md ADR-008, and implemented same-day across all 12 pages (internal links, canonical tags, og:url, a `_redirects` file 301ing the legacy `.html` paths). Hosting/deployment is also resolved (Cloudflare proxies to Netlify, GitHub push triggers deploy). Remaining Sprint 2 scope, sitemap.xml, robots.txt, favicon/manifest consistency, Core Web Vitals baseline, is no longer blocked and is ready to schedule.

## Completed (prior sprints)

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

Sprint 2's remaining scope: favicon/manifest consistency, Core Web Vitals baseline. Neither blocked.

## Next Milestone

Favicon/manifest declarations made consistent across all pages (docs/TECHNICAL_SEO.md finding 11), and a Core Web Vitals baseline once tooling capable of measuring it is available.

## Known Risks

Seven Consultancy Events GTM triggers (discovery_call_started, discovery_call_booked, commercial_diagnostic_requested, commercial_audit_requested, contact_form_submitted, email_clicked, phone_clicked) plus linkedin_clicked are not yet built. phone_clicked has no tel link on the site currently to fire on. GTM container has not yet been published (per GOOGLE_TAG_MANAGER.md Next item 1), awaiting Fabien to run Preview mode and Submit in tagmanager.google.com. privacy-policy.html and cookie-policy.html were rewritten to reflect GA4/GTM use; worth a final read-through once the container is published.

## Reference

See docs/IMPLEMENTATION_LOG.md, docs/GOOGLE_TAG_MANAGER.md, docs/ARCHITECTURE.md, docs/ARCHITECTURAL_DECISIONS.md, docs/ROADMAP.md, and docs/TECHNICAL_SEO.md for full detail behind each item above.

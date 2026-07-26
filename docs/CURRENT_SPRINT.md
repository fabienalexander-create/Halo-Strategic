# Current Sprint

Status: Living Document
Owner: Claude Browser
Maintainer: Claude Browser
Last Updated: 2026-07-26

## Sprint

Sprint 1 - Technical SEO & Analytics

## Status

Sprint 1 is complete in full as of 2026-07-26. The approved architecture (docs/ARCHITECTURE.md, docs/ARCHITECTURAL_DECISIONS.md, docs/ROADMAP.md) and the approved Technical SEO audit (docs/TECHNICAL_SEO.md) were committed by Claude Cowork in commit ee3caf6 on 2026-07-26. Per docs/ROADMAP.md, Sprint 1 scope split three ways, all now done: nav/footer/GTM parity on terms-and-conditions.html and 404.html; audit-coverage closure on cookie-policy.html and thank-you.html; and Organization + FAQPage schema, approved by Fabien and recorded as docs/ARCHITECTURAL_DECISIONS.md ADR-007, then implemented the same day. LocalBusiness schema remains deferred pending a registered business address (ADR-007), not invented or guessed. Sprint 2 (URL strategy, sitemap.xml/robots.txt) remains explicitly out of scope for Sprint 1 per docs/ROADMAP.md and has its own separate blocker, see Next Milestone.

## Completed (prior sprints)

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

URL strategy, Sprint 2 not Sprint 1: extensioned versus extensionless paths, and the Insights URL pattern. Pending Fabien's approval, and itself pending confirmation of the hosting/deployment mechanism (docs/PROJECT_CONTEXT.md, Open Items). Did not block Sprint 1 and does not retroactively affect it now that Sprint 1 is complete.

## Blocked

Sprint 2 cannot start meaningfully: the hosting/deployment mechanism (whether Cloudflare is a proxy or the origin, what triggers a deploy from `main`) is unconfirmed, and the URL strategy ADR depends on it, per docs/ARCHITECTURAL_DECISIONS.md's Pending Decisions and docs/ROADMAP.md's Sprint 2 Dependency note. This is a fact only Fabien can supply, not something to infer or guess.

## Ready for Implementation

Sprint 1 is fully complete, nothing remains ready and unauthorised in its scope. Sprint 2 is not ready to start, see Blocked above.

## Next Milestone

Fabien to confirm the hosting/deployment mechanism, unblocking the URL strategy ADR, so Sprint 2 (sitemap.xml, robots.txt, favicon/manifest consistency, Core Web Vitals baseline) can begin.

## Known Risks

Seven Consultancy Events GTM triggers (discovery_call_started, discovery_call_booked, commercial_diagnostic_requested, commercial_audit_requested, contact_form_submitted, email_clicked, phone_clicked) plus linkedin_clicked are not yet built. phone_clicked has no tel link on the site currently to fire on. GTM container has not yet been published (per GOOGLE_TAG_MANAGER.md Next item 1), awaiting Fabien to run Preview mode and Submit in tagmanager.google.com. privacy-policy.html and cookie-policy.html were rewritten to reflect GA4/GTM use; worth a final read-through once the container is published.

## Reference

See docs/IMPLEMENTATION_LOG.md, docs/GOOGLE_TAG_MANAGER.md, docs/ARCHITECTURE.md, docs/ARCHITECTURAL_DECISIONS.md, docs/ROADMAP.md, and docs/TECHNICAL_SEO.md for full detail behind each item above.

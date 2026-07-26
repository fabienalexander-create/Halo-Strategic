# Current Sprint

Status: Living Document
Owner: Claude Browser
Maintainer: Claude Browser
Last Updated: 2026-07-26

## Sprint

Sprint 1 - Technical SEO & Analytics

## Status

Sprint 1's non-schema scope is complete as of 2026-07-26. The approved architecture (docs/ARCHITECTURE.md, docs/ARCHITECTURAL_DECISIONS.md, docs/ROADMAP.md) and the approved Technical SEO audit (docs/TECHNICAL_SEO.md) were committed by Claude Cowork in commit ee3caf6 on 2026-07-26. Per docs/ROADMAP.md, Sprint 1 scope split three ways. First, nav/footer/GTM parity on terms-and-conditions.html and 404.html, and audit-coverage closure on cookie-policy.html and thank-you.html, were both approved and completed 2026-07-26 (see Completed below); nothing remains in this part of Sprint 1's scope. Second, partially blocked: Organization and FAQPage schema, also Sprint 1 scope per docs/ROADMAP.md, cannot start yet, since docs/ARCHITECTURAL_DECISIONS.md records Schema Philosophy as Pending Product Owner Approval, not yet an approved ADR; Fabien must approve the schema types and rollout order first. Third, out of scope for Sprint 1 rather than a Sprint 1 blocker: URL strategy and sitemap.xml/robots.txt, both explicitly scoped by docs/ROADMAP.md to Sprint 2, which states Sprint 1 does not touch URLs and can proceed independently of the URL strategy decision. This document previously described the URL strategy as a Sprint 1 blocker; that was inaccurate and has been corrected here.

## Completed (prior sprints)

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

Schema rollout, Organization and FAQPage: docs/ARCHITECTURE.md's Schema Philosophy section is written and recommended, but docs/ARCHITECTURAL_DECISIONS.md records it as Pending Product Owner Approval. Do not implement until Fabien approves the schema types and rollout order.

URL strategy, Sprint 2 not Sprint 1: extensioned versus extensionless paths, and the Insights URL pattern. Pending Fabien's approval, and itself pending confirmation of the hosting/deployment mechanism (docs/PROJECT_CONTEXT.md, Open Items). Does not block Sprint 1.

## Blocked

None for Sprint 1's non-schema scope, which is now fully complete. See Awaiting Approval above for schema (still gated) and outside Sprint 1, Sprint 2's URL strategy.

## Ready for Implementation

Nothing remains ready and unauthorised in Sprint 1's non-schema scope; both items (nav/footer/GTM parity, audit-coverage closure) are done, see Completed above. Schema remains gated on Product Owner approval, see Awaiting Approval.

Explicitly out of scope for Sprint 1 per docs/ROADMAP.md: URL strategy changes, Insights, sitemap.xml/robots.txt, and Organization/FAQPage schema until approved.

## Next Milestone

Fabien to approve the schema types and rollout order in docs/ARCHITECTURE.md's Schema Philosophy section, converting it to an approved ADR, so the schema portion of Sprint 1 can begin. Separately, Fabien and Cowork to confirm the hosting/deployment mechanism and resolve the URL strategy ADR ahead of Sprint 2.

## Known Risks

Seven Consultancy Events GTM triggers (discovery_call_started, discovery_call_booked, commercial_diagnostic_requested, commercial_audit_requested, contact_form_submitted, email_clicked, phone_clicked) plus linkedin_clicked are not yet built. phone_clicked has no tel link on the site currently to fire on. GTM container has not yet been published (per GOOGLE_TAG_MANAGER.md Next item 1), awaiting Fabien to run Preview mode and Submit in tagmanager.google.com. privacy-policy.html and cookie-policy.html were rewritten to reflect GA4/GTM use; worth a final read-through once the container is published.

## Reference

See docs/IMPLEMENTATION_LOG.md, docs/GOOGLE_TAG_MANAGER.md, docs/ARCHITECTURE.md, docs/ARCHITECTURAL_DECISIONS.md, docs/ROADMAP.md, and docs/TECHNICAL_SEO.md for full detail behind each item above.

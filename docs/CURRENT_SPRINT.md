# Current Sprint

Status: Living Document
Owner: Claude Browser
Maintainer: Claude Browser
Last Updated: 2026-07-26

## Sprint

Sprint 1 - Technical SEO & Analytics

## Status

Not yet started (per docs/IMPLEMENTATION_LOG.md, "Next" section).

## Completed (prior sprints)

- Sprint 0, Site Reconciliation (2026-07-25): unified three inconsistent nav/footer templates into one canonical design system across all seven main pages. See CHANGELOG.md, IMPLEMENTATION_LOG.md, RECONCILIATION_REPORT.md.
- Google Tag Manager container (GTM-T49HRT6J) installed on 10 of 12 pages; GA4 configuration tag confirmed already present. See GOOGLE_TAG_MANAGER.md.

## In Progress

- None currently logged.

## Awaiting Approval

- None currently logged.

## Blocked

- Sprint 1 (Technical SEO) scope has not yet been confirmed as an approved audit. No TECHNICAL_SEO.md findings exist in the repo yet. Per the agreed operating model, Claude Browser should not begin technical SEO implementation until Claude Cowork has produced an approved audit and Fabien has approved the URL strategy.
- GTM container has not yet been published (per GOOGLE_TAG_MANAGER.md "Next" item 1), awaiting Fabien to run Preview mode and Submit in tagmanager.google.com.
- terms-and-conditions.html and 404.html do not yet have the GTM snippet or the unified nav/footer template applied.

## Next Milestone

Cowork to produce an approved Technical SEO audit (TECHNICAL_SEO.md) and confirm the URL strategy decision, so Browser can begin Sprint 1 implementation.

## Known Risks

- Seven "Consultancy Events" GTM triggers (discovery_call_started, discovery_call_booked, commercial_diagnostic_requested, commercial_audit_requested, contact_form_submitted, email_clicked, phone_clicked) plus linkedin_clicked are not yet built.
- phone_clicked has no tel: link on the site currently to fire on.
- privacy-policy.html and cookie-policy.html were rewritten to reflect GA4/GTM use; worth a final read-through once the container is published.

## Reference

See docs/IMPLEMENTATION_LOG.md and docs/GOOGLE_TAG_MANAGER.md for full detail behind each item above.

# Project Context

Status: Living Document
Owner: Claude Browser
Maintainer: Claude Browser
Last Updated: 2026-07-26
Version: 0.1

## What Halo Strategic Is

Halo Strategic is Fabien Alexander's commercial growth consultancy site, live at https://halostrategic.com. The site presents Halo's Commercial Diagnostic and Commercial Audit services, founder background, evidenced client Growth Stories, and Halo's stated operating principles ("How Halo Thinks").

## Repository

GitHub: fabienalexander-create/Halo-Strategic
Default/production branch: main
The repository is the implementation source of truth. The live site is the verification source of truth. See docs/AI_OPERATING_MODEL.md.

## Tech Stack

- Static HTML/CSS site, no client-side framework observed.
- Pages are generated via a small Python template system (common.py holds shared header/footer/style generation, one build script per page) rather than hand-edited per page. See docs/IMPLEMENTATION_LOG.md.
- Google Tag Manager container GTM-T49HRT6J installed on 10 of 12 pages; GA4 property (Measurement ID G-KC0RH0SS1L) configured inside it. See docs/GOOGLE_TAG_MANAGER.md.

## Hosting and Deployment

Live requests to halostrategic.com are served through Cloudflare (confirmed via cdn-cgi requests observed on the live site). Whether Cloudflare is a proxy in front of another host, or the origin itself, has not been confirmed and should be verified by Fabien. The deployment process, meaning how a commit to main becomes a live change, has not been confirmed and should not be assumed; treat as a human/manual step until documented otherwise.

## Site Pages

index.html, about.html, contact.html, commercial-diagnostic.html, commercial-audit.html, how-halo-thinks.html, selected-engagements.html, privacy-policy.html, cookie-policy.html, terms-and-conditions.html, thank-you.html, 404.html.

## Current Sprint

See docs/CURRENT_SPRINT.md for live status. As of this writing: Sprint 0 (Site Reconciliation) complete; Sprint 1 (Technical SEO & Analytics) not yet started.

## Team Roles

See docs/AI_OPERATING_MODEL.md for full detail. Summary: Fabien Alexander (Product Owner / Design Authority), Claude Cowork (Architect), Claude Browser (Implementation Engineer), ChatGPT (Strategic Advisor).

## Documentation Map

- docs/PROJECT_CONTEXT.md, this file.
- docs/AI_OPERATING_MODEL.md, roles, responsibilities, escalation rules.
- docs/CURRENT_SPRINT.md, live sprint status.
- docs/IMPLEMENTATION_GUIDE.md, how implementation work is done, verified, documented.
- docs/CHANGELOG.md and docs/IMPLEMENTATION_LOG.md, history of production changes.
- docs/SITE_ARCHITECTURE.md and docs/RECONCILIATION_REPORT.md, Sprint 0 findings, an interim architecture reference pending Cowork's ARCHITECTURE.md.
- docs/GOOGLE_TAG_MANAGER.md, analytics/tagging implementation detail.
- docs/TECHNICAL_SEO.md, docs/ARCHITECTURE.md, docs/ARCHITECTURAL_DECISIONS.md, docs/ROADMAP.md, owned by Claude Cowork; placeholders only until Cowork produces first drafts.

## Open Items Requiring Confirmation

- Exact hosting provider and deployment mechanism.
- Whether a Sprint 2.1-style Technical SEO audit exists anywhere outside this repository; none was found in docs/ at time of writing.

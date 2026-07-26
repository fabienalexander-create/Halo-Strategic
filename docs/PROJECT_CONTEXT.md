# Project Context

Status: Living Document
Owner: Claude Browser
Maintainer: Claude Browser
Last Updated: 2026-07-26
Version: 0.2

## What Halo Strategic Is

Halo Strategic is Fabien Alexander's commercial growth consultancy site, live at https://halostrategic.com. The site presents Halo's Commercial Diagnostic and Commercial Audit services, founder background, evidenced client Growth Stories, and Halo's stated operating principles (How Halo Thinks).

## Repository

GitHub: fabienalexander-create/Halo-Strategic. Default/production branch: main. The repository is the implementation source of truth. The live site is the verification source of truth. See docs/AI_OPERATING_MODEL.md.

## Tech Stack

Static HTML/CSS site, no client-side framework observed. Pages are directly-maintained static HTML files. Earlier documentation described a Python template system (common.py, one build script per page) as the generation mechanism, but that tooling could not be located anywhere in this repository's history or in related local locations searched, as of 2026-07-26. See docs/ARCHITECTURAL_DECISIONS.md, ADR-001 Amendment. Until that tooling is located or rebuilt, treat any shared UI change as a manual, per-file edit requiring explicit cross-page verification. Google Tag Manager container GTM-T49HRT6J is installed on 10 of 12 pages, with GA4 property (Measurement ID G-KC0RH0SS1L) configured inside it. See docs/GOOGLE_TAG_MANAGER.md.

## Hosting and Deployment

Live requests to halostrategic.com are served through Cloudflare (confirmed via cdn-cgi requests observed on the live site). Whether Cloudflare is a proxy in front of another host, or the origin itself, has not been confirmed and should be verified by Fabien. The deployment process, meaning how a commit to main becomes a live change, has not been confirmed and should not be assumed; treat as a human/manual step until documented otherwise. docs/ARCHITECTURAL_DECISIONS.md's Pending Decisions section notes this same open point blocks the URL strategy ADR ahead of Sprint 2.

## Site Pages

index.html, about.html, contact.html, commercial-diagnostic.html, commercial-audit.html, how-halo-thinks.html, selected-engagements.html, privacy-policy.html, cookie-policy.html, terms-and-conditions.html, thank-you.html, and 404.html. docs/ARCHITECTURE.md confirms this same twelve-page sitemap as verified current, as of commit 7c7dbc0.

## Current Sprint

See docs/CURRENT_SPRINT.md for live status. As of this writing: Sprint 0 (Site Reconciliation) is complete, Sprint 1A (Google Tag Manager Installation) and Sprint 1B (Service Parameter Plumbing and Mailto Links) are complete (2026-07-25), and the architecture and Technical SEO audit that Sprint 1 depends on were approved and committed by Claude Cowork on 2026-07-26 (commit ee3caf6). Sprint 1, Technical SEO & Analytics, as scoped in docs/ROADMAP.md, is now partially ready: nav/footer/GTM parity on the two remaining pages and audit-coverage closure can proceed, while Organization/FAQPage schema remains pending Fabien's approval.

## Team Roles

See docs/AI_OPERATING_MODEL.md for full detail. Summary: Fabien Alexander (Product Owner / Design Authority), Claude Cowork (Architect), Claude Browser (Implementation Engineer), ChatGPT (Strategic Advisor).

## Documentation Map

docs/PROJECT_CONTEXT.md, this file. docs/AI_OPERATING_MODEL.md, roles, responsibilities, escalation rules. docs/CURRENT_SPRINT.md, live sprint status. docs/IMPLEMENTATION_GUIDE.md, how implementation work is done, verified, documented. docs/CHANGELOG.md and docs/IMPLEMENTATION_LOG.md, history of production changes. docs/SITE_ARCHITECTURE.md and docs/RECONCILIATION_REPORT.md, Sprint 0 findings; SITE_ARCHITECTURE.md served as an interim architecture reference pending Cowork's ARCHITECTURE.md and is now superseded by it for long-term architecture questions, though docs/ARCHITECTURE.md confirms the two still agree as of this writing. docs/GOOGLE_TAG_MANAGER.md, analytics/tagging implementation detail. docs/ARCHITECTURE.md, docs/ARCHITECTURAL_DECISIONS.md, docs/ROADMAP.md, and docs/TECHNICAL_SEO.md, owned by Claude Cowork. These were approved and committed on 2026-07-26 (commit ee3caf6) and are now the live architectural source of truth, not placeholders; this Documentation Map previously described them as placeholders pending Cowork's first drafts, that language is now out of date and has been corrected here.

## Open Items Requiring Confirmation

Exact hosting provider and deployment mechanism, still open, see docs/ARCHITECTURAL_DECISIONS.md's Pending Decisions.

## Resolved Items

Whether a Sprint 2.1-style Technical SEO audit exists anywhere outside this repository: resolved 2026-07-26. docs/TECHNICAL_SEO.md is that audit (it is internally titled Technical SEO Audit, Sprint 2.1), committed in ee3caf6 alongside docs/ARCHITECTURE.md, docs/ARCHITECTURAL_DECISIONS.md, and docs/ROADMAP.md.

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

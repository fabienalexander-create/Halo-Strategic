# Changelog

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

# Implementation Log

## Sprint 0 — Site Reconciliation (2026-07-25)

**Trigger.** A Website Authority & SEO Deployment brief was approved to proceed with Sprint 0 (reconciliation) before Sprint 1 (Technical SEO). Live-site crawl during scoping found the site running three inconsistent nav/footer templates across seven pages, not one coherent site. Full findings in `docs/RECONCILIATION_REPORT.md`.

**Inspect.** Fetched raw source (not just rendered text) for all seven pages via the GitHub repo to work from real markup rather than assumptions. Confirmed: Family A (index, commercial-diagnostic, commercial-audit, contact) shared one stylesheet and nav/footer. Family B (selected-engagements, how-halo-thinks) used an entirely separate, self-contained stylesheet with different CSS variable names and no shared components. About.html used a variant of Family A's stylesheet with its own nav wording.

**Analyse.** Family A's design system (nav, footer, hero pattern, card grid, page-table/FAQ/step-row components) was the most complete and reusable. Decision: build one canonical stylesheet as the union of every component in use across all seven pages, standardise the nav and footer everywhere, and migrate Family B's two pages onto it without altering their content.

**Decisions made and why:**
- Kept all existing copy on every page untouched. Only navigation, footer, internal linking, and the homepage's two known defects (dead case study links, thin Evidence section) were changed.
- Migrated how-halo-thinks.html and selected-engagements.html's page-header pattern onto Family A's existing `.hero` component (eyebrow + h1 + lead) instead of keeping their bespoke `.page-head` component, since Family A's hero already does the same job and is used identically on Contact, Commercial Diagnostic, and Commercial Audit.
- Found and resolved one CSS class collision: about.html's `.story` (paragraph-spacing wrapper) versus selected-engagements.html's `.story` (article card). Renamed about.html's to `.founder-story` rather than risk the two stylesheets fighting once merged.
- Added six internal links specified in the approved brief (Audit→Engagements, Audit→About, About→Thinks, Engagements→Audit, Thinks→Diagnostic) plus several supporting ones that came up naturally while rebuilding each page (Contact→About, homepage service cards→Diagnostic/Audit).
- Did not add an "Evidence" nav item separate from Selected Engagements. The homepage's on-page Evidence section already links to Selected Engagements directly, adding a second nav destination for the same content would work against the "no isolated destination, no duplicate destination" goal.

**Implement.** Built via a small Python template system (`common.py` holds the shared `<style>` block, header, and footer generators; one build script per page) rather than hand-editing seven copies of near-identical markup, this makes any future shared change (adding an eighth page, adjusting the nav) a one-file edit instead of seven.

**Verify.** Automated checks across all seven output files before pushing: zero literal `href="#"` placeholder links (down from 2 on the homepage), zero missing closing tags, consistent nav (6 items) and footer (13 items) counts on every page, all six Selected Engagements anchor IDs preserved, no leftover template artifacts. No visual/screenshot render was available in this environment (no headless browser installed), so verification was structural and content-diff based rather than pixel-based; recommend a manual visual pass on the live URLs after deploy.

**Document.** This entry, plus `docs/CHANGELOG.md` and `docs/SITE_ARCHITECTURE.md`.

**Commit.** Pushed as one commit to `main` covering all seven HTML files plus the three doc files.

**Next.** Sprint 1 — Technical SEO & Analytics. Analytics (GA4) and Search Console are being set up separately by Fabien, out of scope here. Sprint 1 covers: sitemap.xml (currently empty/missing), meta description and canonical audit across all pages (mostly already present, needs verification), image alt text audit, schema markup (Organization, LocalBusiness, potentially Article once Insights exists), Core Web Vitals spot-check, and a broken-link sweep of the remaining un-crawled pages (privacy-policy, cookie-policy, terms-and-conditions, thank-you, 404).

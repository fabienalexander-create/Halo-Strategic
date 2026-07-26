# Halo Strategic — Architectural Roadmap

Status: Living Document
Owner: Claude Cowork
Maintainer: Claude Cowork
Last Updated: 2026-07-26
Version: 1.0

Architectural objectives and outcomes only. This is not a task list, implementation tasks and their sequencing belong in docs/CURRENT_SPRINT.md, owned and updated by Browser as work happens.

**Numbering note:** docs/CURRENT_SPRINT.md already calls the next sprint "Sprint 1 - Technical SEO & Analytics." The sprints below adopt that same numbering (Sprint 1, 2, 3) rather than starting a second, parallel count, since CURRENT_SPRINT.md is the live tracker Browser actually updates. Sprint 1 below covers a subset of what CURRENT_SPRINT.md's Sprint 1 description originally scoped (it split GTM/nav gaps and schema out from sitemap/robots/Core Web Vitals, sequencing the latter behind the URL strategy decision). If Browser has already started work under its own reading of "Sprint 1," reconcile scope against this document before continuing, don't run both scopes in parallel.

## Sprint 1: Close the Verified Gaps + Foundational Schema

**Objective:** Bring the two lagging pages (terms-and-conditions.html, 404.html) onto the canonical nav/footer/GTM baseline every other page already has, and give the site its first structured data, closing the largest concrete gaps identified in docs/TECHNICAL_SEO.md.

**Architectural outcomes:**
- Site-wide navigation and footer consistency reaches 12/12 pages (currently 10/12 confirmed, 2 confirmed outstanding).
- GTM coverage reaches 12/12 pages (currently 10/12 confirmed correct, 2 confirmed missing).
- Organization schema exists site-wide, implemented once in the shared template, not per-page.
- FAQPage schema exists on commercial-audit.html, generated from the existing visible FAQ markup rather than duplicated separately.
- cookie-policy.html and thank-you.html are brought into audit scope and confirmed, closing the two unverified items from the Sprint 2.1 audit.

**Gate:** the two schema outcomes above (Organization, FAQPage) are Pending Product Owner Approval per docs/ARCHITECTURAL_DECISIONS.md, Schema Philosophy is not yet an approved ADR. Browser should implement the nav/GTM/audit-coverage outcomes first; schema implementation should not start until Fabien has approved the schema types and rollout order in docs/ARCHITECTURE.md's Schema Philosophy section.

**Explicitly out of scope for Sprint 1:** URL strategy changes, Insights, sitemap.xml/robots.txt (these depend on decisions or content that don't exist yet, see below).

## Sprint 2: Sitemap, Robots, and URL Strategy Resolution

**Objective:** Build the crawl infrastructure the URL strategy decision unblocks.

**Status (2026-07-26):** URL strategy is resolved, extensionless, recorded as ADR-008, and implemented, every internal link, canonical tag, and `og:url` across all 12 pages uses the extensionless form, with a `_redirects` file 301ing the legacy `.html` paths. Hosting/deployment is also resolved (Cloudflare proxies to Netlify, GitHub push triggers deploy). Neither remains a dependency for the rest of this sprint.

**Architectural outcomes:**
- ~~URL strategy decision recorded as an approved ADR~~ — done, see ADR-008.
- sitemap.xml generated and submitted, reflecting the now-resolved extensionless URLs.
- robots.txt added, pointing to the sitemap.
- Favicon/manifest declarations made consistent across all pages (currently inconsistent per docs/TECHNICAL_SEO.md finding 11), folded into whatever template pass touches the shared header next.
- Core Web Vitals baseline established, using tooling capable of measuring it (not available in the environment that produced the Sprint 2.1 audit).

**Remaining work:** sitemap.xml, robots.txt, favicon/manifest consistency, and Core Web Vitals baseline. None of these are blocked any longer; they're ready to schedule.

## Sprint 3: Insights Foundation

**Objective:** Stand up the Insights section as an architectural capability, not a content sprint. Content strategy and the SEO Content Architecture v1.1 document govern what gets published; this sprint governs whether the site can publish it at all.

**Status (2026-07-26):** Insights exists and article #1 is published. Most architectural outcomes below are done for a single article; the scaling flag is explicitly not resolved, see below.

**Architectural outcomes:**
- ~~The CMS/no-CMS decision is made explicitly~~ — not done. Defaulted again by necessity of shipping quickly (ADR-004, note added 2026-07-26). Still genuinely open once article volume grows.
- `/insights/` index and `/insights/every-department-can-be-doing-its-job-well` exist, extensionless, consistent with the URL strategy resolved in Sprint 2 (ADR-008).
- Insights added to primary navigation in the specified position, done across all pages.
- Article schema: not implemented. Deferred, same as it was before Insights existed (ADR-007 covers Organization + FAQPage only); a genuine decision point now that Insights is real, not automatically unblocked by this sprint.
- Cross-linking pattern: article #1 links to two relevant Selected Engagements anchors and to How Halo Thinks and Commercial Diagnostic. The Topical Authority Map / pillar-linking structure referenced here has not been separately verified to exist; this was done based on the article's own actual content, not a formal map.

**Explicitly out of scope for Sprint 3:** Framework Library, FAQ Hub, Resources. These remain correctly sequenced after Insights per docs/ARCHITECTURE.md and should not be pulled forward without a specific reason recorded as an ADR.

**Scaling flag for this sprint: resolved 2026-07-26, ADR-009.** A local generator (`tools/build-insights.js`, templates, and a JSON data file) replaces hand-copying boilerplate per article. Adding article #2 is one new entry in `tools/insights-articles.json` plus a script run, not a new hand-copied file. Verified against zero regression: regenerating the two existing Insights pages from the new system produced byte-for-byte identical output. Not a CMS, still requires editing JSON and running a script by hand; non-technical publishing remains unsolved and undecided (ADR-004).

## Sequencing Notes

Sprints 1 through 3 are ordered by dependency, not by calendar assumption. Sprint 2 depends on a Product Owner decision (URL strategy) and a Product Owner confirmation (hosting/deployment model) that Sprint 1 does not require. Sprint 3 depends on Sprint 2's URL structure. If the URL strategy decision stalls, Sprint 1 can still proceed independently, it does not touch URLs. Do not start Sprint 3 work ahead of the Sprint 2 URL decision; that is the exact mistake docs/ARCHITECTURE.md's URL Philosophy section warns against, retrofitting structure after content exists costs more than deciding first.

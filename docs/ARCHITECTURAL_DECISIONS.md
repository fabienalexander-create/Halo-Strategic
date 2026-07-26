# Halo Strategic — Architectural Decisions

Status: Living Document
Owner: Claude Cowork
Maintainer: Claude Cowork
Last Updated: 2026-07-26
Version: 1.0

Architecture Decision Records (ADRs). Only approved decisions are recorded here. Each entry is dated and immutable once approved; a decision that changes gets a new ADR that supersedes the old one, the old one is not edited.

---

## ADR-001: Static HTML with a shared Python template system, no framework

**Status:** Approved (design); implementation unverified as of 2026-07-26, see Amendment below
**Owner:** Claude Cowork (recorded retroactively)
**Approved by:** Fabien (implicit, by not objecting to the Sprint 0 implementation approach documented in docs/IMPLEMENTATION_LOG.md)
**Reason:** Twelve pages, infrequent updates, one non-technical-in-code founder as the primary content owner. A build-time template system (`common.py` generating shared header/footer/style, one script per page) gets the maintainability benefit of componentisation without the operational overhead of a JS framework, a build pipeline, or hosting requirements beyond static file serving.
**Alternatives considered:** Hand-edited per-page HTML (rejected, this is exactly what produced the three-template inconsistency Sprint 0 had to fix). A JS framework (React/Next etc.) (not seriously evaluated at this scale, disproportionate to twelve static pages).
**Consequences:** Any shared UI change is a one-file edit. Any move to dynamic content (CMS, per-article publishing) will require revisiting this decision, see ADR-004.
**Amendment (2026-07-26):** A search of this repository's full git history (`git log --all --diff-filter=A --name-only`) found no `.py` file and no `site/` directory committed at any point. Related local locations (halo-site-package.zip, the .openclaw workspace, the rest of Documents and Downloads) were also searched and found nothing. The design decision and reasoning above are unchanged and still stand as intended architecture. However, "(implemented)" cannot currently be verified: the 12 HTML files in this repository are, as far as can be confirmed, directly maintained rather than generated. Treat the committed HTML as the canonical implementation until the referenced tooling is located or a real templating system is built. This is a correction of an implementation-status claim, not a new architectural decision, so no new ADR was created for it.

---

## ADR-002: Family A's design system as canonical, Family B content migrated onto it

**Status:** Approved, partially implemented (10 of 12 pages confirmed as of commit 7c7dbc0, 2 pages outstanding, see Consequences)
**Owner:** Claude Browser (implementation), Claude Cowork (architectural sign-off, recorded retroactively)
**Approved by:** Fabien
**Reason:** Pre-Sprint-0, the site ran three inconsistent nav/footer/stylesheet families (docs/RECONCILIATION_REPORT.md). Family A (index, commercial-diagnostic, commercial-audit, contact) was newest, most commercially complete, and what paid traffic would land on first. Family B (selected-engagements, how-halo-thinks) held real, valuable content built on a separate stylesheet. Family C (about) matched neither.
**Alternatives considered:** Building a fourth, entirely new shared system (rejected, unnecessary rework when Family A's components already covered every case in use). Keeping three systems and just adding cross-links (rejected, does not fix the underlying inconsistency, only papers over it).
**Consequences:** Verified implemented and correct as of commit 7c7dbc0 across index, about, contact, commercial-diagnostic, commercial-audit, how-halo-thinks, selected-engagements, and privacy-policy (8 of 12). Verified **not yet applied** to terms-and-conditions.html and 404.html (2 of 12); cookie-policy.html and thank-you.html not independently re-checked in this pass (2 of 12, see docs/TECHNICAL_SEO.md). The two confirmed gaps are tracked as docs/ROADMAP.md Sprint 1 scope, not a new architectural question, the target state under this ADR is unchanged.

---

## ADR-003: Google Tag Manager as the single, extensible analytics layer

**Status:** Approved (implemented)
**Owner:** Claude Browser (implementation), Claude Cowork (architectural sign-off, recorded retroactively)
**Approved by:** Fabien
**Reason:** One container (`GTM-T49HRT6J`) housing GA4 as the base measurement layer, with every future tool (Google Ads, LinkedIn Insight Tag, Microsoft Clarity, Meta Pixel, cookie consent) addable as tags/triggers inside the same container. Avoids code changes to the site for every new marketing tool.
**Alternatives considered:** Hardcoding GA4 directly into pages without GTM (rejected, loses the ability to add future tags without a code deploy). A separate tag manager per tool (rejected, unnecessary duplication and page-weight cost).
**Consequences:** Every future analytics or ads tool addition is a GTM-admin change, not a code change, provided it's added inside the existing container. The container was pushed to code but, per docs/CURRENT_SPRINT.md, has not yet been published in the GTM admin UI, that is an operational step for Fabien, not an architectural gap.

---

## ADR-004: No CMS or backend at this stage

**Status:** Approved (default, by omission)
**Owner:** Claude Cowork
**Approved by:** Pending explicit Product Owner confirmation. This has not been actively decided against; it is the status quo and is recorded here so it is visible rather than assumed.
**Reason:** Static site fits current publishing cadence (one founder, infrequent updates).
**Alternatives considered:** Not yet evaluated, deliberately, since no trigger condition (see docs/ARCHITECTURE.md, Future Scalability) has been reached.
**Consequences:** Insights, when built, will force this decision one way or another. Recommend making it explicitly as part of the Insights build ADR rather than defaulting into a choice by not deciding.

**Note (2026-07-26):** Insights was built, and this decision was not made explicitly, it defaulted again, by necessity of shipping one article quickly. Article #1 was hand-authored, no CMS, no templating, the same direct-maintenance approach as every other page. This is consistent with the existing default, not a violation of it, but it means the trigger condition this ADR describes ("Insights needs frequent, non-technical publishing," docs/ARCHITECTURE.md Future Scalability) is now closer, not resolved. The explicit decision this ADR recommends still has not been made, and shouldn't keep defaulting silently once article volume actually grows.

**Update (2026-07-26, ADR-009):** the build-scaling half of this concern is now addressed, a local generator (templates + JSON + a script) replaces hand-copying boilerplate for Insights specifically. This is not a CMS: it doesn't enable non-technical publishing, still requires editing a JSON file and running a script, and this ADR's actual open question (CMS vs. no CMS) remains genuinely undecided.

---

## ADR-005: One shared template system is the only place UI changes are made

**Status:** Approved (design); enforcement mechanism unverified as of 2026-07-26, see Amendment below
**Owner:** Claude Cowork
**Approved by:** Fabien (implicit, consistent with ADR-001 and the reasoning in docs/RECONCILIATION_REPORT.md's root-cause finding)
**Reason:** Promoted from docs/ARCHITECTURE.md's Design Principles to a formal ADR because it is a binding constraint on implementation, not just descriptive background, and Design Principles is easy for a future contributor to skim past. The three-template inconsistency Sprint 0 had to fix (docs/RECONCILIATION_REPORT.md) was caused directly by hand-editing shared UI per page instead of through one shared generator. That failure mode should not be allowed to recur.
**Alternatives considered:** Allowing occasional direct per-page edits for "small" nav/footer tweaks (rejected, this is exactly how three inconsistent families accumulated in the first place, there is no reliably "small" exception).
**Consequences:** Any nav, footer, or shared-style change must go through `common.py` and the per-page build scripts, never a direct edit to a page's rendered `<header>`/`<footer>`/`<style>` block. If a change genuinely can't go through the shared generator, that is itself a signal the templating approach needs revisiting, escalate it as a new ADR rather than hand-editing around it.
**Amendment (2026-07-26):** Per ADR-001's amendment, `common.py` and the per-page build scripts referenced above could not be located anywhere in this repository's history or in the related local locations searched. Until that tooling is located or rebuilt, this rule cannot be mechanically enforced, there is currently no generator to route changes through. Interim practice: any shared UI change must instead be applied by hand, consistently, across every affected HTML file, with explicit before/after verification across all pages touched, standing in for the safeguard a real generator would otherwise provide. The underlying rule, that shared UI should not drift per-page, is unchanged; only the enforcement mechanism's existence was disproven.

---

## ADR-006: Anchor IDs are a stability contract, not an implementation detail

**Status:** Approved (implemented)
**Owner:** Claude Cowork
**Approved by:** Fabien (implicit, consistent with the cross-linking already built in Sprint 0)
**Reason:** Promoted from docs/ARCHITECTURE.md's Design Principles for the same reason as ADR-005: it's a binding rule, not background colour. Selected Engagements' six stories are linked to by ID from the homepage (`#reacting-to-leading`, `#data-never-missing`) and from How Halo Thinks and About. An anchor ID silently changing or a story being removed breaks every inbound link with no build-time warning, since these are plain HTML anchors, not a framework's routed references that would fail to compile.
**Alternatives considered:** Treating anchor IDs as freely renameable implementation detail (rejected, the cost of a silent break, dead internal links with no error, is disproportionate to the convenience of renaming freely).
**Consequences:** Any edit to selected-engagements.html or how-halo-thinks.html that would change or remove an existing anchor ID must be treated as a breaking change requiring a full sweep of inbound links across the site first, not a routine content edit. This applies equally to the future Framework Library pages described in docs/ARCHITECTURE.md, if those are anchor-linked from Selected Engagements stories, the same contract applies.

---

## ADR-007: Schema rollout — Organization site-wide and FAQPage on commercial-audit.html, approved; LocalBusiness and Article deferred

**Status:** Approved (implemented)
**Owner:** Claude Cowork (Schema Philosophy recommendation, docs/ARCHITECTURE.md), approval recorded by Claude Code
**Approved by:** Fabien, in conversation, 2026-07-26
**Reason:** Adopts docs/ARCHITECTURE.md's Schema Philosophy recommended priority order, items 1 and 3 only. Organization is lowest-risk, highest-baseline-value, and site-wide. FAQPage on commercial-audit.html is generated directly from the page's existing five `<details>/<summary>` FAQ entries, so visible content and structured data cannot drift apart, since one was copied from the other at the time of writing.
**Deferred, not rejected:** LocalBusiness (recommendation item 2) requires a registered business address Halo is comfortable publishing; none has been supplied, and per docs/ARCHITECTURE.md's own instruction, no address is invented or guessed. Revisit if and when Fabien supplies one. Article (item 4) is explicitly deferred until Insights exists, unchanged from the original recommendation.
**Alternatives considered:** None beyond docs/ARCHITECTURE.md's own recommended order and reasoning; this ADR adopts that reasoning rather than re-deriving it.
**Consequences:** Every page carries an identical Organization JSON-LD block (name, url, logo, sameAs LinkedIn, contactPoint email), inserted by hand immediately after the GTM block on all 12 pages, since no template generator exists to route this through (see ADR-005 Amendment). commercial-audit.html additionally carries an FAQPage JSON-LD block matching its five visible FAQ entries verbatim. Any future edit to commercial-audit.html's FAQ content must be mirrored in the FAQPage schema block, or the two will drift, exactly the failure mode this schema choice was meant to avoid structurally, but hand-editing across two locations does not enforce that automatically the way a shared generator would.

---

## ADR-008: Extensionless URLs, with 301 redirects from the legacy `.html` paths

**Status:** Approved (implemented)
**Owner:** Claude Code, evidence gathered and documented in the URL Architecture Decision Record delivered 2026-07-26
**Approved by:** Fabien, in conversation, 2026-07-26
**Reason:** Direct testing of the live production site found that both `/about` and `/about.html` already resolved with `200 OK` and no redirect between them, Netlify's untouched default pretty-URL behaviour colliding with a codebase written entirely around `.html` links and canonical tags. `docs/ARCHITECTURE.md`'s URL Philosophy section had already recorded Cowork's lean toward extensionless paths being the more natural fit once `/insights/[slug]` exists. Given the choice had to be made either way to close the duplicate-resolution gap, Fabien chose extensionless.
**Alternatives considered:** Keeping `.html` and adding a redirect rule the other direction (extensionless → `.html`). Rejected in favour of the option already leaning documented in `ARCHITECTURE.md`, and because it front-loads the larger one-time link migration now rather than leaving it to complicate the future Insights build.
**Consequences:** Every internal link, canonical tag, and `og:url`/`twitter` reference across all 12 pages now uses the extensionless form (for example `/about`, not `about.html`); the homepage's own canonical and links use `/`. A `_redirects` file at the repository root 301s every legacy `.html` path to its extensionless equivalent (except `404.html`, left alone since Netlify uses that exact filename as its error-page convention, not a page anyone navigates to via a link). `docs/ARCHITECTURE.md`'s URL Philosophy section should be updated to describe this as the current implemented state rather than a future recommendation, see the same-day pass that follows this ADR. Any future page (including Insights) should be built extensionless from the start; no further migration should be needed.

**Confirmed extended, same day:** when Insights was stood up a few hours later (2026-07-26), its two pages (`/insights`, `/insights/every-department-can-be-doing-its-job-well`) were built extensionless from the start, per this ADR's own instruction, with matching forced `_redirects` entries for their `.html` filenames. No further URL migration was needed, exactly as predicted here.

---

## ADR-009: Local template + JSON generator for Insights articles, no CMS, no Netlify-side build

**Status:** Approved (implemented)
**Owner:** Claude Code
**Approved by:** Fabien, in conversation, 2026-07-26, in response to "Decide on the build approach before article #2"
**Reason:** Article #1 was hand-authored by copying ~250 lines of shared boilerplate (head, `<style>` block, nav, footer, GTM, schema) into a new file and editing the middle. That approach is exactly what ADR-001 already ruled out for the 12 root-level pages when it chose a template system over hand-editing, and docs/ARCHITECTURE.md's Future Scalability section explicitly flagged it as not scaling past a handful of Insights articles. The actual, demonstrated pain point this session (duplicate GTM blocks, duplicate active-nav classes, a redirect double-hop, all caught only by manual verification) was hand-copying boilerplate and shared elements drifting out of sync across files, not a lack of a CMS or a lack of non-technical publishing. A CMS or a Netlify-side build step would solve problems nobody has actually hit yet; a generator solves the one that already happened.
**Alternatives considered:** A full CMS or headless CMS (rejected, solves non-technical publishing, which nobody has asked for; disproportionate to one founder publishing occasionally, same reasoning as ADR-004). A Netlify-side build step (a `netlify.toml` build command running a real static site generator) (rejected for now, introduces a new toolchain dependency, `package.json`, `node_modules`, a build step that must succeed for every deploy, for a benefit the simpler local-generator approach already captures). Continuing to hand-copy per article (rejected, this is the problem being solved).
**Consequences:** `tools/insights-article-template.html` and `tools/insights-index-template.html` hold the shared boilerplate once, with `{{TOKEN}}` placeholders. `tools/insights-articles.json` holds per-article data (slug, title, h1, meta description, category, teaser, publish date, body HTML). `tools/build-insights.js` generates `insights/index.html` and `insights/{slug}.html` from these and must be run locally after any edit to the JSON or templates; it does not run automatically on deploy. The generated files are committed normally, like any other change, review the diff before committing, same as everything else this session. Adding article #2 means adding one entry to `insights-articles.json` and running the script, not hand-copying another 250 lines. A shared-element change (nav, footer, GTM, schema) affecting Insights pages still needs a corresponding change to the templates, followed by a re-run, it does not yet reach the 12 root-level pages, which remain hand-maintained exactly as before (ADR-001 Amendment); unifying the two is a larger, separate decision, not made here.
**Verified:** regenerated both existing Insights pages from the new templates and JSON data and diffed the output against the already-published, already-approved files: byte-for-byte identical after fixing one real bug the diff caught (an unescaped `&` in the category field, the same class of bug as the terms-and-conditions.html fix earlier this session). The generator now HTML-escapes all plain-text fields (title, meta description, h1, teaser, category) and deliberately does not escape the body field, which is meant to contain real markup, consistent with how every other page's content is hand-authored HTML, not escaped plain text.

---

## ADR-010: Client-side pricing config and Commercial Health Check, no backend added

**Status:** Approved (implemented)
**Owner:** Claude Code
**Approved by:** Fabien, as Product Owner, 2026-07-26, Sprint 5.6: "Approved by Product Owner... Proceed with implementation... Implement using configurable values (not hard-coded)."
**Reason:** The approved product ecosystem (docs/PRODUCT_SYSTEM.md) required repricing two live products (Commercial Diagnostic, Commercial Audit) and adding a new free self-assessment product (Commercial Health Check), with an explicit instruction that "future pricing changes should require content/configuration updates only, not code changes." The site has no backend, no CMS, and no payment processing (ADR-004); a real pricing database or checkout flow is out of scope for a static site with no build step beyond the Insights generator (ADR-009).
**Decision:** `pricing-config.js`, a single root-level file, holds all prices as data (`window.HALO_PRICING`), read at runtime by any page via `<span data-price="...">` elements. Changing a price means editing one file, not hunting through HTML across four pages. The structure supports adding a second currency (e.g. GBP) as a new key under `currencies`, but no GBP figures are set, only the USD prices Fabien actually approved exist; inventing a converted GBP figure would misrepresent an undecided price as final (see docs/PRICING_STRATEGY.md, which flags the US-market/currency question as still open). The Commercial Health Check itself is a vanilla-JS, client-side self-assessment (6 questions, one per Commercial Leakage Framework area, scored 0–18, banded into three results), with no data submitted or stored anywhere, consistent with this site's privacy-by-default posture elsewhere (cookie/analytics handling).
**Alternatives considered:** A real backend/database for pricing (rejected, disproportionate to a static site with two prices; ADR-004's reasoning against a CMS/backend applies identically here). Hardcoding the new prices directly into each page's HTML (rejected, explicitly ruled out by the approval itself). A third-party quiz/form tool for the Health Check (rejected, adds an external dependency and likely a data-collection/privacy surface for a 6-question scored quiz simple enough to build directly).
**Consequences:** `commercial-diagnostic.html`, `commercial-audit.html`, `commercial-health-check.html`, and `product-journey.html` all load `pricing-config.js`. The Commercial Audit page's FAQPage JSON-LD (ADR-007) still has its price stated as static text, not a `data-price` span, structured data isn't reliably re-rendered from client-side JS by crawlers, so that one block needs manual updating alongside any future price change, a known follow-up, not an oversight. No real payment processing exists: "booking" the paid Diagnostic still routes to the existing contact form, same as before, actual invoicing/payment collection remains a manual, off-site process until a real e-commerce decision is made, which this ADR does not make.
**Verified:** grep-checked `data-price` and GTM/schema occurrence counts across all four pricing-aware pages; confirmed `sitemap.xml` well-formed (15 `<url>` tags, balanced) and `_redirects` covers both new pages.

---

## Pending decisions (no ADR yet, do not build against these as if approved)

- **Hosting/deployment mechanism**: resolved 2026-07-26. Cloudflare is a proxy in front of Netlify, not the origin (confirmed via `x-nf-request-id` response headers present on every live request checked). Fabien confirmed directly that GitHub is the deploy trigger, pushing to `main` deploys the site. Note: GitHub shows zero commit status checks and zero deployment records for any commit pushed this session, a reporting gap in the GitHub↔Netlify connection, not evidence deploys aren't happening; verifying against the live site directly remains the only independent confirmation a push has actually landed.
- **URL strategy**: resolved 2026-07-26, see ADR-008.
- **LocalBusiness schema**: deferred pending a registered business address Fabien is comfortable publishing, see ADR-007.
- **Article schema for Insights**: still not decided, see docs/ROADMAP.md, Sprint 3. Not automatically unblocked by ADR-009, which covers the build mechanism, not schema.
- **Whether the 12 root-level pages should move onto the same template+generator approach as Insights**: not decided here. ADR-009 deliberately scoped itself to Insights only, since that's where the demonstrated pain was. Revisit if hand-maintaining the 12 root pages becomes the actual bottleneck, not speculatively.
- **Information architecture for Framework Library, FAQ Hub, Resources**: sequencing and nav placement are proposed in docs/ARCHITECTURE.md, but timing (when each gets built) is a roadmap and resourcing decision, not an architecture decision, see docs/ROADMAP.md.
- **Future CMS decision**: not yet triggered, see ADR-004. ADR-009 is a generator, not a CMS, this remains open.
- **US market positioning / regional pricing**: Sprint 5.6 implemented USD pricing site-wide per Fabien's approval, but the underlying question, is Halo formally pursuing US-market positioning, remains undecided (see docs/PRICING_STRATEGY.md). `pricing-config.js` (ADR-010) supports adding GBP or other currencies later without code changes, but no GBP figures exist yet.
- **Halo Clarity Guarantee legal review**: implemented as approved placeholder copy (14-day refund window, on-request, no review step) per Fabien's explicit instruction not to delay implementation for this. Still needs real solicitor/accountant review before the refund mechanism is treated as final, see docs/GUARANTEE.md.
- **Growth Blueprint, Commercial Operating System, and every Stage 4–6 product's pricing**: not set. Only Health Check, Diagnostic, and Audit have real prices; the rest of docs/PRODUCT_SYSTEM.md's ecosystem is structurally live on `/product-journey` but explicitly marked "by proposal" or "retainer" with no figure attached.

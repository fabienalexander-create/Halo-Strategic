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

## Pending decisions (no ADR yet, do not build against these as if approved)

- **URL strategy**: extensioned (`.html`) vs. extensionless paths, and whether Insights uses `/insights/[slug]` vs. `/insights/[slug].html`. Flagged as blocking implementation in docs/CURRENT_SPRINT.md. Pending Product Owner approval, and itself blocked on the hosting confirmation below.
- **Hosting/deployment mechanism**: resolved 2026-07-26. Cloudflare is a proxy in front of Netlify, not the origin (confirmed via `x-nf-request-id` response headers present on every live request checked). Fabien confirmed directly that GitHub is the deploy trigger, pushing to `main` deploys the site. Note: GitHub shows zero commit status checks and zero deployment records for any commit pushed this session, a reporting gap in the GitHub↔Netlify connection, not evidence deploys aren't happening; verifying against the live site directly remains the only independent confirmation a push has actually landed. This no longer blocks the URL strategy decision below on the hosting-model question; the URL strategy decision itself (extensioned vs. extensionless) remains open, see docs/PROJECT_CONTEXT.md and the URL Architecture Decision Record delivered 2026-07-26.
- **LocalBusiness schema**: deferred pending a registered business address Fabien is comfortable publishing, see ADR-007.
- **Information architecture for Insights, Framework Library, FAQ Hub, Resources**: sequencing and nav placement are proposed in docs/ARCHITECTURE.md, but timing (when each gets built) is a roadmap and resourcing decision, not an architecture decision, see docs/ROADMAP.md.
- **Future CMS decision**: not yet triggered, see ADR-004.

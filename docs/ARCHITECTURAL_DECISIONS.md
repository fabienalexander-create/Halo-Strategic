# Halo Strategic — Architectural Decisions

Status: Living Document
Owner: Claude Cowork
Maintainer: Claude Cowork
Last Updated: 2026-07-26
Version: 1.0

Architecture Decision Records (ADRs). Only approved decisions are recorded here. Each entry is dated and immutable once approved; a decision that changes gets a new ADR that supersedes the old one, the old one is not edited.

---

## ADR-001: Static HTML with a shared Python template system, no framework

**Status:** Approved (implemented)
**Owner:** Claude Cowork (recorded retroactively)
**Approved by:** Fabien (implicit, by not objecting to the Sprint 0 implementation approach documented in docs/IMPLEMENTATION_LOG.md)
**Reason:** Twelve pages, infrequent updates, one non-technical-in-code founder as the primary content owner. A build-time template system (`common.py` generating shared header/footer/style, one script per page) gets the maintainability benefit of componentisation without the operational overhead of a JS framework, a build pipeline, or hosting requirements beyond static file serving.
**Alternatives considered:** Hand-edited per-page HTML (rejected, this is exactly what produced the three-template inconsistency Sprint 0 had to fix). A JS framework (React/Next etc.) (not seriously evaluated at this scale, disproportionate to twelve static pages).
**Consequences:** Any shared UI change is a one-file edit. Any move to dynamic content (CMS, per-article publishing) will require revisiting this decision, see ADR-004.

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

**Status:** Approved (implemented)
**Owner:** Claude Cowork
**Approved by:** Fabien (implicit, consistent with ADR-001 and the reasoning in docs/RECONCILIATION_REPORT.md's root-cause finding)
**Reason:** Promoted from docs/ARCHITECTURE.md's Design Principles to a formal ADR because it is a binding constraint on implementation, not just descriptive background, and Design Principles is easy for a future contributor to skim past. The three-template inconsistency Sprint 0 had to fix (docs/RECONCILIATION_REPORT.md) was caused directly by hand-editing shared UI per page instead of through one shared generator. That failure mode should not be allowed to recur.
**Alternatives considered:** Allowing occasional direct per-page edits for "small" nav/footer tweaks (rejected, this is exactly how three inconsistent families accumulated in the first place, there is no reliably "small" exception).
**Consequences:** Any nav, footer, or shared-style change must go through `common.py` and the per-page build scripts, never a direct edit to a page's rendered `<header>`/`<footer>`/`<style>` block. If a change genuinely can't go through the shared generator, that is itself a signal the templating approach needs revisiting, escalate it as a new ADR rather than hand-editing around it.

---

## ADR-006: Anchor IDs are a stability contract, not an implementation detail

**Status:** Approved (implemented)
**Owner:** Claude Cowork
**Approved by:** Fabien (implicit, consistent with the cross-linking already built in Sprint 0)
**Reason:** Promoted from docs/ARCHITECTURE.md's Design Principles for the same reason as ADR-005: it's a binding rule, not background colour. Selected Engagements' six stories are linked to by ID from the homepage (`#reacting-to-leading`, `#data-never-missing`) and from How Halo Thinks and About. An anchor ID silently changing or a story being removed breaks every inbound link with no build-time warning, since these are plain HTML anchors, not a framework's routed references that would fail to compile.
**Alternatives considered:** Treating anchor IDs as freely renameable implementation detail (rejected, the cost of a silent break, dead internal links with no error, is disproportionate to the convenience of renaming freely).
**Consequences:** Any edit to selected-engagements.html or how-halo-thinks.html that would change or remove an existing anchor ID must be treated as a breaking change requiring a full sweep of inbound links across the site first, not a routine content edit. This applies equally to the future Framework Library pages described in docs/ARCHITECTURE.md, if those are anchor-linked from Selected Engagements stories, the same contract applies.

---

## Pending decisions (no ADR yet, do not build against these as if approved)

- **URL strategy**: extensioned (`.html`) vs. extensionless paths, and whether Insights uses `/insights/[slug]` vs. `/insights/[slug].html`. Flagged as blocking implementation in docs/CURRENT_SPRINT.md. Pending Product Owner approval, and itself blocked on the hosting confirmation below.
- **Hosting/deployment mechanism**: whether Cloudflare is a proxy or the origin, and what triggers a deploy from `main`. Flagged as unconfirmed in docs/PROJECT_CONTEXT.md. This blocks the URL strategy decision above, since any URL change needs a redirect mechanism that depends on the hosting model. Pending Fabien's confirmation, not really an "architecture" decision so much as a fact to establish, but recorded here because two other pending decisions depend on it.
- **Schema strategy**: which schema types to implement and in what order (see docs/ARCHITECTURE.md, Schema Philosophy, for the recommended default). Pending Product Owner approval.
- **Information architecture for Insights, Framework Library, FAQ Hub, Resources**: sequencing and nav placement are proposed in docs/ARCHITECTURE.md, but timing (when each gets built) is a roadmap and resourcing decision, not an architecture decision, see docs/ROADMAP.md.
- **Future CMS decision**: not yet triggered, see ADR-004.

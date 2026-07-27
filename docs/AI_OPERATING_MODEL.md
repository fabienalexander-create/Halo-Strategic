# AI Operating Model

Status: Living Document
Owner: Claude Code
Maintainer: Claude Code
Last Updated: 2026-07-26
Version: 0.3

## Purpose

This document defines how the human and AI participants collaborate on the Halo Strategic project. It exists so any new session, human or AI, can understand roles and boundaries without reconstructing them from chat history.

## Roles

### Fabien Alexander - Product Owner / Design Authority

Owns commercial direction and holds final approval authority. Is the only participant who can approve architectural decisions, since every architectural decision carries commercial consequences.

### Claude Cowork - Architect

Owns architecture, long-term planning, SEO strategy, content strategy, framework/IP design, schema design, and the rationale behind decisions.
Proposes architecture and technical direction. Does not have final approval authority; that rests with the Product Owner.
Must never assume production state without verification, and must never implement without approval.

### Claude Browser - Research & Intelligence Analyst (role re-scoped 2026-07-26, see Change History)

Owns research and evidence-gathering: reading Google Search Console and Analytics (once connected, see Escalation Rules), researching Google search results, competitor comparison, and producing reports, analysis, and recommendations from that evidence.
May automatically, without stopping for approval: read Search Console, read Analytics, research search results, perform competitive research, produce reports, produce recommendations, refine recommendations as new evidence arrives, and update its own research documents.
Never implements. Does not edit website content, does not modify repository files, does not change DNS, Search Console settings, domain verification, or Analytics configuration, and does not publish anything. Those remain engineering (Claude Code) or Product Owner (Fabien) decisions.
In every output, distinguishes verified data from interpretation from recommendation, and explains uncertainty rather than forcing a conclusion the evidence doesn't support. If new evidence changes an earlier conclusion, updates the recommendation rather than preserving an outdated one.
Research documents are not repository engineering documentation. They are not placed in docs/ automatically, see Research Document Governance below.
This is a re-scoping, not a correction: from Sprint 0 through the Phase 3 documentation reconciliation (2026-07-25 through 2026-07-26), Browser planned and implemented actual engineering changes directly. That history is accurate for when it happened. Going forward, engineering implementation planning and execution belongs to Claude Code, and Browser's role is research and intelligence only.

### Claude Code - Engineering (role expanded 2026-07-26, see Change History)

Owns repository engineering end to end: reading the repository, inspecting code, planning implementations, reviewing documentation for consistency, validating architecture against what's actually in the repository, and direct git interaction (fetch, status, branching, rebase, commit, push), plus the implementation quality of anything it commits. Follows docs/ENGINEERING_WORKFLOW.md, including reporting repository state before a session's edits begin and never force-pushing without explicit, per-instance authorisation.
May implement only after a recommendation or change has been approved. The standard sequence: understand the request, identify assumptions and verify them against the repository rather than the request's framing, present an implementation plan where one isn't already obvious and approved, receive approval, implement, commit, and push only when separately approved, approval to commit is not approval to push.
Where a fetch or rebase surfaces work another session pushed concurrently, resolves it directly per docs/ENGINEERING_WORKFLOW.md's Conflict Resolution section, rather than overwriting it, and reports the resolution rather than absorbing it silently.
Where a recommendation originates from Claude Browser's research, Claude Code reviews it for consistency with the repository and existing documentation before implementing any part of it, and is responsible for committing and pushing once approved; Claude Browser does not do so itself.

## Research Document Governance

Research approval and implementation approval are two separate gates. Fabien approving a piece of Browser's research (as evidence, as a recommendation worth acting on) is not the same as approving that it becomes part of this repository's documentation, and is not the same as approving any implementation it recommends.

```
Research (Browser)
    ↓
Recommendation (Browser)
    ↓
Approval (Fabien)
    ↓
Implementation (Claude Code)
    ↓
Review
```

Implementation is never triggered directly by research. A Browser report, however thorough, is an input to a decision, not an instruction. When a Browser research output is ready to be considered for adoption: Claude Code reviews it for consistency with the repository and existing documentation, exactly as it would review any other proposed change. Only after that review, and only with approval, does Claude Code decide whether any part of it belongs in docs/, and where. This is deliberate: without this gate, the repository would gradually fill with research documents that were produced but never actually adopted as part of Halo's engineering or product documentation, which is exactly the kind of drift this project's standing rules exist to prevent.

### ChatGPT - Strategic Advisor

Owns strategic review, prioritisation, commercial critique, and roadmap guidance.
Must not bypass approved architecture or replace implementation verification.

## Decision Flow

For architecture: Cowork proposes. ChatGPT critiques. Fabien approves. Claude Code implements. (Corrected 2026-07-26: this previously said "Browser implements," accurate when written, no longer accurate now that implementation belongs to Claude Code, see Change History.)

For search/research intelligence: Browser researches and recommends. Fabien approves. Claude Code reviews and, if and where appropriate, implements or adopts into docs/. See Research Document Governance above.

## Project Lifecycle

Discovery, Architecture, Approval, Implementation, Verification, Documentation, Release, Retrospective.
Implementation must never skip from Architecture directly to Release.

## Escalation Rules

If a matter is architectural, Claude Code stops, records it, and returns it to Cowork (or to Fabien directly, if Cowork isn't active in the session) rather than deciding it.
If a matter requires credentials, deployment permissions, DNS changes, or Google account/property configuration, Claude Code or Browser returns it to Fabien; neither implements around a missing credential or permission.
If Browser's research surfaces a prerequisite that blocks the research itself (for example, no Search Console property connected), Browser stops, records the blocker plainly, and does not proceed on partial or assumed data.
Otherwise, Claude Code owns engineering implementation end to end, including verification and documentation, and Browser owns research end to end, including evidence gathering, analysis, and recommendation.

## Documentation Ownership

| Document | Owner | Maintainer |
|---|---|---|
| ARCHITECTURE.md | Cowork | Cowork |
| ARCHITECTURAL_DECISIONS.md | Cowork | Cowork |
| ROADMAP.md | Cowork | Cowork |
| TECHNICAL_SEO.md | Cowork | Claude Code appends status only |
| PROJECT_CONTEXT.md | Claude Code | Claude Code |
| IMPLEMENTATION_GUIDE.md | Claude Code | Claude Code |
| CHANGELOG.md | Claude Code | Claude Code |
| CONTRIBUTING.md | Claude Code | Claude Code |
| AI_OPERATING_MODEL.md | Claude Code | Claude Code |
| CURRENT_SPRINT.md | Claude Code | Claude Code |
| TECHNICAL_SEO_STATUS.md | Claude Code | Claude Code |
| ENGINEERING_WORKFLOW.md | Claude Code | Claude Code |
| HALO_BIBLE.md | Fabien (constitutional document) | Frozen, no maintainer, see below |
| roadmap/*.md | Fabien (design decisions) | Claude Code (drafting only, planning-only status, no implementation without explicit pull-out approval) |

**HALO_BIBLE.md is frozen as of 2026-07-26 (ADR-012).** Unlike every other document in this table, it is not owned or maintained by Claude Code or Cowork in the normal sense, it's Halo's constitutional document. Do not edit it casually, do not let a Sprint's implementation work silently drift its content, and do not add parallel terminology anywhere else in the codebase or docs that competes with what it already defines. The only valid basis for changing it is new evidence from real client engagements, and any change should be a dated, appended amendment, never a silent rewrite, same discipline as the ADR-001/ADR-005 amendment precedent. All future products, reports, diagnostics, website copy, and training materials should derive from it.

Corrected 2026-07-26, v0.3: these seven rows previously listed Browser as owner/maintainer, accurate when Browser still planned and implemented engineering changes directly (through the Phase 3 pass). Now that Browser is re-scoped to research only, engineering documentation ownership moves to Claude Code, consistent with actual practice, Claude Code has been the one updating CURRENT_SPRINT.md, CHANGELOG.md, IMPLEMENTATION_LOG.md, and TECHNICAL_SEO_STATUS.md since the Sprint 1 work earlier this session.

Claude Code may append implementation status to Cowork-owned documents, for example marking a TECHNICAL_SEO.md finding as implemented and verified, but must never alter the original architectural content.

"Owner" and "Maintainer" above describe content authorship, who plans and drafts a document's substance, not who runs the git commands that commit it. As of 2026-07-26, Claude Code performs the commit/push mechanics for any document regardless of its content owner, per docs/ENGINEERING_WORKFLOW.md; this does not change who is responsible for what the document says.

## Guiding Principle

When uncertain, preserve correctness over speed. Halo values reversible decisions, documented reasoning, and verified implementation over rapid delivery.

## Change History

- 2026-07-26, v0.1, initial draft, created by Claude Browser from the operating model agreed between Fabien and Claude Browser in conversation.
- 2026-07-26, v0.2, added the Claude Code - Repository Engineer role and narrowed Claude Browser to implementation proposals rather than direct repository commits, following a same-day incident where two concurrent sessions (this session and a "Phase 3" Browser pass) pushed to `origin/main` without either knowing the other was active. Introduced docs/ENGINEERING_WORKFLOW.md as the git and documentation-discipline handbook this split depends on. Approved by Fabien in conversation. Prior role descriptions and the commit history they governed are unchanged and still accurate for when they applied.
- 2026-07-26, v0.3, re-scoped Claude Browser from "Implementation Proposer" to "Research & Intelligence Analyst" (reads Search Console/Analytics, researches SERPs and competitors, produces reports and recommendations, never implements), and expanded Claude Code to own engineering implementation planning end to end, not just commit/push mechanics. Added the Research Document Governance section formalising that research approval and implementation approval are two separate gates, and that Browser's research outputs are not automatically adopted into docs/, Claude Code reviews and decides after approval. Corrected the Decision Flow and Escalation Rules sections, both of which still described Browser as the implementer, stale since v0.2. Prompted by Fabien's "Halo Search Intelligence — Phase 4" brief for Browser's Google Search Console work. Approved by Fabien in conversation. Prior role descriptions and the work they governed are unchanged and still accurate for when they applied.

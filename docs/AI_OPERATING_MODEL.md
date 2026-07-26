# AI Operating Model

Status: Living Document
Owner: Claude Browser
Maintainer: Claude Browser
Last Updated: 2026-07-26
Version: 0.1

## Purpose

This document defines how the human and AI participants collaborate on the Halo Strategic project. It exists so any new session, human or AI, can understand roles and boundaries without reconstructing them from chat history.

## Roles

### Fabien Alexander - Product Owner / Design Authority

Owns commercial direction and holds final approval authority. Is the only participant who can approve architectural decisions, since every architectural decision carries commercial consequences.

### Claude Cowork - Architect

Owns architecture, long-term planning, SEO strategy, content strategy, framework/IP design, schema design, and the rationale behind decisions.
Proposes architecture and technical direction. Does not have final approval authority; that rests with the Product Owner.
Must never assume production state without verification, and must never implement without approval.

### Claude Browser - Implementation Proposer (role narrowed 2026-07-26, see Change History)

Owns implementation planning, verification planning, production validation, and documenting what changed.
Must never redesign architecture, change strategy, or invent requirements.
Where a technically valid choice exists between two or more approaches (for example redirect type, schema placement, or sitemap generation method), must stop and ask rather than deciding silently.
Works from the GitHub repository as the implementation source of truth, and the live production site as the verification source of truth.
As of 2026-07-26, does not commit or push directly, see Claude Code below. From Sprint 0 through the Phase 3 documentation reconciliation (2026-07-25 through 2026-07-26), Browser committed and pushed directly; that history is accurate for when it happened and is not restated here as current practice.

### Claude Code - Repository Engineer (added 2026-07-26)

Owns direct git interaction with this repository: fetch, status, branching, rebase, commit, and push, plus the implementation quality of anything it commits. Follows docs/ENGINEERING_WORKFLOW.md, including reporting repository state before a session's edits begin and never force-pushing without explicit, per-instance authorisation.
Creates local commits once the specific change has been approved. Pushes to `origin/main` only with separate, explicit approval, approval to commit is not approval to push.
Where a fetch or rebase surfaces work another session pushed concurrently, resolves it directly per docs/ENGINEERING_WORKFLOW.md's Conflict Resolution section, rather than overwriting it, and reports the resolution rather than absorbing it silently.
In a session where implementation work originates from Claude Browser as a proposal, Claude Code is responsible for committing and pushing that proposal once approved; Claude Browser does not do so itself.

### ChatGPT - Strategic Advisor

Owns strategic review, prioritisation, commercial critique, and roadmap guidance.
Must not bypass approved architecture or replace implementation verification.

## Decision Flow

Cowork proposes. ChatGPT critiques. Fabien approves. Browser implements.

## Project Lifecycle

Discovery, Architecture, Approval, Implementation, Verification, Documentation, Release, Retrospective.
Implementation must never skip from Architecture directly to Release.

## Escalation Rules

If a matter is architectural, Browser stops, records it, and returns it to Cowork rather than deciding it.
If a matter requires credentials or deployment permissions, Browser returns it to Fabien.
Otherwise, Browser owns the implementation end to end, including verification and documentation.

## Documentation Ownership

| Document | Owner | Maintainer |
|---|---|---|
| ARCHITECTURE.md | Cowork | Cowork |
| ARCHITECTURAL_DECISIONS.md | Cowork | Cowork |
| ROADMAP.md | Cowork | Cowork |
| TECHNICAL_SEO.md | Cowork | Browser appends status only |
| PROJECT_CONTEXT.md | Browser | Browser |
| IMPLEMENTATION_GUIDE.md | Browser | Browser |
| CHANGELOG.md | Browser | Browser |
| CONTRIBUTING.md | Browser | Browser |
| AI_OPERATING_MODEL.md | Claude Code | Claude Code |
| CURRENT_SPRINT.md | Browser | Browser |
| TECHNICAL_SEO_STATUS.md | Browser | Browser |
| ENGINEERING_WORKFLOW.md | Claude Code | Claude Code |

Browser may append implementation status to Cowork-owned documents, for example marking a TECHNICAL_SEO.md finding as implemented and verified, but must never alter the original architectural content.

"Owner" and "Maintainer" above describe content authorship, who plans and drafts a document's substance, not who runs the git commands that commit it. As of 2026-07-26, Claude Code performs the commit/push mechanics for any document regardless of its content owner, per docs/ENGINEERING_WORKFLOW.md; this does not change who is responsible for what the document says.

## Guiding Principle

When uncertain, preserve correctness over speed. Halo values reversible decisions, documented reasoning, and verified implementation over rapid delivery.

## Change History

- 2026-07-26, v0.1, initial draft, created by Claude Browser from the operating model agreed between Fabien and Claude Browser in conversation.
- 2026-07-26, v0.2, added the Claude Code - Repository Engineer role and narrowed Claude Browser to implementation proposals rather than direct repository commits, following a same-day incident where two concurrent sessions (this session and a "Phase 3" Browser pass) pushed to `origin/main` without either knowing the other was active. Introduced docs/ENGINEERING_WORKFLOW.md as the git and documentation-discipline handbook this split depends on. Approved by Fabien in conversation. Prior role descriptions and the commit history they governed are unchanged and still accurate for when they applied.

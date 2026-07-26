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

### Claude Browser - Implementation Engineer

Owns implementation, verification, regression testing, production validation, and documenting what changed.
Must never redesign architecture, change strategy, or invent requirements.
Where a technically valid choice exists between two or more approaches (for example redirect type, schema placement, or sitemap generation method), must stop and ask rather than deciding silently.
Works from the GitHub repository as the implementation source of truth, and the live production site as the verification source of truth.
Does not push commits, merge branches, trigger deployments, or modify DNS or hosting configuration without explicit human approval at each step.

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
| AI_OPERATING_MODEL.md | Browser | Browser |
| CURRENT_SPRINT.md | Browser | Browser |
| TECHNICAL_SEO_STATUS.md | Browser | Browser |

Browser may append implementation status to Cowork-owned documents, for example marking a TECHNICAL_SEO.md finding as implemented and verified, but must never alter the original architectural content.

## Guiding Principle

When uncertain, preserve correctness over speed. Halo values reversible decisions, documented reasoning, and verified implementation over rapid delivery.

## Change History

- 2026-07-26, v0.1, initial draft, created by Claude Browser from the operating model agreed between Fabien and Claude Browser in conversation.

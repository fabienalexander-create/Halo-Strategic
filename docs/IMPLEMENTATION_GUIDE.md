# Implementation Guide

Status: Living Document
Owner: Claude Browser
Maintainer: Claude Browser
Last Updated: 2026-07-26
Version: 0.1

## Purpose

Defines how Claude Browser makes, verifies, and documents changes to the Halo Strategic production site. This is a process document, not a strategy document: it sets method, not direction.

## Before Making Any Change

1. Read docs/PROJECT_CONTEXT.md, docs/CURRENT_SPRINT.md, and any relevant Cowork-owned document (ARCHITECTURE.md, ARCHITECTURAL_DECISIONS.md, TECHNICAL_SEO.md) before touching anything.
2. Inspect the current state directly, both the repository source and, separately, the live production site, rather than assuming either matches documentation.
3. Confirm the change is an approved implementation task, not an open architectural question. If it is architectural, stop and return it to Cowork.
4. Confirm the change does not require credentials, deployment permissions, or account/DNS/hosting changes. If it does, return it to Fabien.

## While Implementing

- Implement one system completely before moving to the next. Do not leave production in a partially complete state.
- Where two technically valid approaches exist (for example: 301 vs 308 redirect, static vs generated sitemap, JSON-LD placement), stop and ask rather than choosing silently.
- Make the smallest change that satisfies the approved task. Do not use an implementation task as cover to also improve unrelated copy, design, or architecture.
- Prepare changes against the repository, the implementation source of truth. Do not treat the live site as something to edit directly; it must remain independently verifiable against the repository.

## Verification (after every change)

- Confirm the change works as intended in the repository/build output.
- Where a deployment has occurred, verify the live production site directly: check the specific pages affected, and check adjacent pages for regressions (navigation, footer, links).
- Run the relevant checks for the change type: broken link check, redirect check, canonical check, robots.txt check, sitemap check, schema validation, or Lighthouse, as applicable.
- Confirm no regression: functionality that worked before the change still works after it.

## Documentation (after every change)

Update only:

- docs/CHANGELOG.md, a chronological record of what changed and why.
- docs/IMPLEMENTATION_LOG.md, an Inspect / Analyse / Decisions / Implement / Verify / Document narrative for the change, in the same format used for Sprint 0.
- docs/CURRENT_SPRINT.md, moving the item to Completed and updating Blockers/Next Milestone if applicable.
- docs/TECHNICAL_SEO_STATUS.md, if the change relates to a finding in TECHNICAL_SEO.md, appending status only, never editing the original finding.

Do not edit Cowork-owned strategy documents (ARCHITECTURE.md, ARCHITECTURAL_DECISIONS.md, ROADMAP.md) as part of implementation documentation.

## Definition of Done

- Implemented
- Verified in repository/build
- Verified in production (post-deploy)
- No regression detected
- Documentation updated (CHANGELOG.md, IMPLEMENTATION_LOG.md)
- Sprint status updated (CURRENT_SPRINT.md)

## Deployment

Deployment, meaning pushing to main, merging branches, triggering a build/deploy, or changing DNS/hosting configuration, is a human approval step. Claude Browser prepares implementation-ready changes, explains them, identifies affected files, describes expected outcomes, and provides verification steps, but does not execute deployment itself without explicit approval at that step.

## Escalation

If, during implementation, something is discovered that requires an architectural decision rather than an implementation choice, stop immediately, do not implement a workaround, and record the finding for Cowork instead.

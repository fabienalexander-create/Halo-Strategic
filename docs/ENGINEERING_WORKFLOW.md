# Engineering Workflow

Status: Living Document
Owner: Claude Code
Maintainer: Claude Code
Last Updated: 2026-07-26
Version: 1.0

## Purpose

This is the git and documentation-discipline handbook for anyone, human or AI, doing engineering work in this repository. It exists because a real collision happened on 2026-07-26: two sessions (this one and a concurrent "Phase 3" documentation pass) edited the same files without either knowing the other was active, and a push was rejected as a result. It was resolved by rebasing and reconciling rather than overwriting, but the better outcome is not needing to resolve it after the fact. This document is that prevention.

This document governs git mechanics and evidence/documentation discipline. It does not restate roles or approval authority, see docs/AI_OPERATING_MODEL.md for who decides what.

## Pre-Session Protocol

Before any edits begin in a session:

```
git fetch origin
git status
git log --oneline --decorate --graph --max-count=10
```

Report, before touching anything: current branch, HEAD commit, whether local is ahead/behind `origin/main`, and whether the recent log shows commits from a session that isn't this one. If local is behind, or if the picture is ambiguous, resolve that first. No edits begin until this is confirmed.

## During a Session

Assume this is not the only engineer working against the repository, human or AI. For any change that takes a long time to prepare, or before any commit that will be pushed, re-run `git fetch origin`. If `origin/main` has moved:

- Pause.
- Inspect the new commits properly, read the actual diffs, not just the file names or commit subject lines. A commit that touches the same file is not automatically a conflict of substance, and a commit that touches a different file can still be a conflict of substance (see the Evidence Standard section, the 2026-07-26 collision was exactly this: overlapping files, and one side's new content restated a claim the other side had just disproven).
- Decide whether the incoming work is compatible with what's in progress.
- Rebase onto the new `origin/main`, resolve deliberately (see Conflict Resolution below), then continue.

## Before Every Push

Mandatory sequence, no exceptions:

```
git fetch origin
git rebase origin/main
git push
```

Never `git push --force` or `--force-with-lease` without explicit, per-instance authorisation. A rejected push is a signal to fetch and reconcile, not an obstacle to override. If a push is rejected, stop and report it rather than retrying with force.

## Conflict Resolution

When a rebase produces a conflict, or when a fetch reveals overlapping work even without a literal git conflict:

- Read the full content on both sides before resolving anything. The disagreement is often more than a mechanical text collision, it can be a substantive contradiction between two claims (this is what happened 2026-07-26: both sides edited docs/TECHNICAL_SEO_STATUS.md, but the real issue was that the other side's new content also asserted a fact this session had just spent the whole session disproving).
- Where both sides describe the same fact and one is materially more complete or more recently verified, keep that one and drop the redundant version rather than keeping both.
- Where both sides made a genuine, independent decision or contribution, keep both, in the order they actually happened, and add a note connecting them rather than silently picking one and discarding the other's reasoning.
- Never resolve a conflict by force-pushing over the other side's work, and never resolve it by deleting the other side's content without reading it first.
- After resolving, re-read the commit message you're about to push. If conflict resolution changed what the commit actually contains (for example, a file you meant to touch turned out to be already fixed by the other side and your change to it was dropped), amend the message before pushing so it describes the real diff, not the originally planned one.

## Evidence Standard

Every factual claim added to project documentation should be identifiable as one of three categories, and should say which:

- **Verified fact.** Directly confirmed by inspecting the repository (source files, git history at a pinned commit) or the live site, in this session or a cited prior one. State the commit or the check performed, not just the conclusion.
- **Documentation claim.** Stated in a docs/ file, not independently re-verified in the current pass. Fine to cite, not fine to treat as ground truth without checking, especially anything load-bearing for an implementation decision.
- **Assumption.** Inferred from pattern, convention, or similarity to verified cases, and explicitly flagged as such rather than presented as fact (docs/TECHNICAL_SEO.md's notes on its two unaudited pages are the model for this).

Do not blend these three in the same sentence without distinguishing them. When correcting a document, say explicitly which category the correction moves a claim into (see docs/ARCHITECTURAL_DECISIONS.md, ADR-001 and ADR-005 Amendments, for the pattern this document is generalising from).

## Source-of-Truth Rules

- The repository, at a pinned commit, is the implementation source of truth. A branch alias or an unpinned fetch is not the same thing and has already produced a false finding once (docs/TECHNICAL_SEO.md's Method and Scope section documents this directly), treat that as a standing warning, not a one-off.
- The live production site is the verification source of truth.
- Neither is assumed to match the other, or to match what documentation says, without checking.
- Documentation should describe what has actually been verified. If something can't currently be verified, say that, rather than asserting it as settled.

## Documentation Standards

- Do not rewrite or delete history. If a past entry (implementation log, changelog, ADR) is later shown to be inaccurate, add a dated clarification or amendment next to it. The original stands as the record of what was believed or decided at the time it was written.
- ADRs record architectural decisions, not implementation status. A change in verified implementation status against an existing ADR is an amendment to that ADR (dated, appended to the existing entry), not grounds for a new ADR, unless the underlying architecture is genuinely being decided differently.
- Documents marked `Status: Living Document` in their header are corrected in place going forward. Audit/finding documents (for example docs/TECHNICAL_SEO.md) are immutable once published; only status is appended elsewhere (docs/TECHNICAL_SEO_STATUS.md), never into the original findings.

## Approval Process

See docs/AI_OPERATING_MODEL.md for full roles and authority. The git-specific gates:

- **Local commits** may be created once the specific change has been approved.
- **Pushes to `origin/main`** require separate, explicit approval, even when the underlying commit was already approved. Approval to commit is not approval to push.
- **Force-push** requires explicit, per-instance authorisation. Never inferred from a general approval to proceed.

## Branch Policy

Single branch, `main`, no feature branches in use as of this writing. If that changes, record the new policy here rather than letting it drift by convention.

## Commit Policy

- One reviewable commit per coherent change, not a batch of unrelated edits.
- Commit messages describe the actual final diff being pushed, not the diff as originally planned, if conflict resolution changed what's in the commit, the message gets amended to match before pushing.
- Every commit created by an AI session carries a co-authorship trailer identifying it as such.

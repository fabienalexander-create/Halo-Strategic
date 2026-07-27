# Halo Strategic — LinkedIn Content System

This folder is Halo's LinkedIn content archive — not a post queue, an IP library. See `docs/LINKEDIN_OPERATING_MANUAL.md` for the full brief (voice, cadence, content mix, visual style, weekly themes). This README covers the folder mechanics only.

**This entire `/content/` path is blocked from public serving** (see `_redirects`, ADR-015) — it lives in the repo as source of truth but is never reachable at halostrategic.com.

## Folder structure

Organised by **status**, not by pillar — pillar is tracked per-post in the frontmatter instead, to avoid a folder-per-pillar × folder-per-status combinatorial mess:

- `draft/` — written, not yet approved by Fabien.
- `scheduled/` — approved, with a publish date set, waiting to go out.
- `published/` — actually posted to LinkedIn. Move the file here (and update its `Status` field) once it's live.
- `archived/` — retired posts (superseded, or pulled), kept for the record rather than deleted.

## File naming

`YYYY-MM-DD-slug.md`, e.g. `2026-07-27-buying-a-crm-for-a-broken-sales-process.md`. The date is the intended or actual publish date, not the date written.

## Per-post file structure

Every post is one Markdown file with this frontmatter, matching the Operating Manual's spec exactly:

```yaml
---
title: ""
publish_date: YYYY-MM-DD
status: draft | scheduled | published | archived
pillar: diagnosis-before-prescription | commercial-patterns | selected-engagements | leadership | agency-partnerships | commercial-frameworks | behind-halo
format: story | observation | framework | question | lesson | diagram | short-essay | myth | mini-case-study | commercial-truth | list | one-liner
weekly_theme: commercial-myth | selected-engagement | framework | commercial-pattern | founder-lesson | none
word_count_target: 50 | 100-220 | 300
hashtags: []
website_link: https://halostrategic.com
source: ""
---
```

Followed by these sections in the body:

```markdown
## LinkedIn copy

(the actual post text)

## Image prompt

(description of the visual — see the Operating Manual's Image Style section)

## Notes

(why this was written, what it supports, what it draws on — internal only, never posted)
```

See `_TEMPLATE.md` in this folder for a ready-to-copy blank file.

## Quality gate before moving draft/ → scheduled/

From the Operating Manual: would McKinsey publish this? No — good. Would Halo publish this? Yes. Could another consultancy publish the exact same post? If yes, rewrite it. Also check: no invented statistics, no invented case studies, no invented client names or outcomes — every claim traces to a Selected Engagement, the Halo Bible, or a genuinely original observation, same evidence rule as the Insights articles.

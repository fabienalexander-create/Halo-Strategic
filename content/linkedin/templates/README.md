# Halo Strategic — LinkedIn Image Templates

Reusable HTML/CSS templates rendered to PNG via headless Chrome, instead of prompting an AI image generator per post. Advantages: pixel-perfect brand consistency, real Halo fonts (Fraunces/Inter/IBM Plex Mono) and real hex values (`#101A30` navy, `#B08D57` bronze — pulled directly from the live website's own CSS, not approximated), text that's never mangled, crisp at any resolution, and edits take seconds.

## Templates

| Template | Use for |
|---|---|
| `quote-card.html` | A short quote, stat, or one-liner (2-line headline + support line) |
| `stat-card.html` | One big hero number with a label and short context |
| `framework.html` | A numbered sequence (up to 6 steps) |
| `checklist.html` | A checklist (up to 6 items) |
| `timeline.html` | A sequential timeline (up to 5 points) |
| `comparison.html` | Two-column "X vs Y" comparison (up to 4 rows each side) |
| `flowchart.html` | A linear top-to-bottom flow (up to 5 boxes) |
| `carousel.html` | One slide of a multi-slide carousel — render once per slide |
| `ad-offer.html` | Paid ad creative: headline (up to 3 lines) + support line + bronze offer line. `vw`/`vh`-sized so it renders correctly at both 1200x1200 and 1200x627 from the same markup — see `content/ads/*/README.md` for a campaign using it |

Every template shares the same foundation: navy `#101A30` background, bronze `#B08D57`/`#D8BE8F` accents, white `#F6F6F3` text, thin bronze top bar, bottom rule with "HALO STRATEGIC" wordmark and "halostrategic.com". That consistent shell is deliberate — the goal (per the Operating Manual) is that a Halo graphic is recognisable even with the logo cropped out, from typography, spacing, and layout alone.

## Rendering a post's image

```
node render.js <template-name> <data.json> <output-basename> [--wide]
```

- `<template-name>` — filename without `.html`, e.g. `quote-card`
- `<data.json>` — a small JSON file of `{{TOKEN}}` values, matching the template's placeholders (see each template's `{{...}}` tokens directly, or copy the pattern from an existing `content/linkedin/generated/*.html` output)
- `<output-basename>` — usually the post's date-slug, e.g. `2026-07-27-more-leads-wont-fix-a-follow-up-problem`
- `--wide` — 1200×627 instead of the default 1200×1200 square

Writes both `generated/<output-basename>.html` (for inspection/editing) and `generated/<output-basename>.png` (the actual upload-ready image).

**List-style templates** (framework, checklist, timeline, comparison, flowchart): just omit unused `ITEM`/`STEP`/`ROW` keys from the data JSON entirely — `render.js` hides empty slots automatically. Don't include a slot with empty text; an empty box still renders.

## Requirements

Needs a local Chrome or Edge install (`render.js` checks both standard Windows install paths). No npm install, no Playwright/Puppeteer dependency — just a plain `--headless=new --screenshot=...` invocation, kept intentionally simple to match this repo's "local generator, not a build pipeline" philosophy (same reasoning as `tools/build-insights.js`).

## Where images end up

`content/linkedin/generated/` — blocked from public serving along with the rest of `/content/` (see ADR-015). Reference the relevant `.png` in a post's `image_filename` frontmatter field once rendered.

`render.js` also copies every rendered PNG to `Documents/Halo Strategic/09 Editorial & Content Engine/LinkedIn Images/`, since `content/linkedin/generated/` lives under the hidden `.claude` folder and is awkward to find in a normal file picker — this matters because attaching the image to LinkedIn's post composer cannot be automated (see below) and has to be done by hand from a visible folder.

## A note on LinkedIn's post composer

LinkedIn's "create post" modal doesn't expose its contents to accessibility-tree-based browser tools (confirmed 2026-07-27) — screenshots render it fine, but element-reference-based tools (needed for file uploads) only see the page behind it. Post text and links can still be typed in directly; the image attach step needs a human to click the photo icon and pick the file themselves, from the visible folder above.

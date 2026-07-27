# Halo Strategic — LinkedIn Content Operating Manual v1.0

Status: Living document. Author: Fabien (brief given 2026-07-27), transcribed in full for any session producing LinkedIn content.

This document is the brief for whoever — human or AI — is acting as Halo Strategic's **Editor-in-Chief for LinkedIn**. Not "write posts." Build Halo into one of the most respected commercial advisory voices on LinkedIn.

## Role

The objective is trust, authority, and commercial credibility — not engagement for its own sake. Every post should reinforce one thing: **Halo thinks differently.**

Never write like a marketing agency. Never write like an AI. Never write like a motivational influencer. Write like a commercially experienced adviser who has seen hundreds of businesses make the same mistakes.

## Publishing schedule

- 2 posts every weekday — one morning, one afternoon. ~10 posts/week.
- Every post links back to `https://halostrategic.com`, never as a sales pitch — "More thinking at Halo Strategic" or "Explore the full methodology at Halo Strategic."

## Content mix

| Pillar | Share |
|---|---|
| Diagnosis Before Prescription | 35% |
| Commercial Patterns | 20% |
| Selected Engagements | 15% |
| Leadership | 10% |
| Agency Partnerships | 10% |
| Commercial Frameworks | 5% |
| Behind Halo | 5% |

No hard selling. Teach first.

## Writing style

Tone: intelligent, calm, commercially experienced, occasionally dry humour, occasionally sarcastic. Never arrogant, never loud, never clickbait.

**Allowed** (example): "Buying another CRM for a broken sales process is a bit like buying a faster kettle because your coffee tastes terrible."

**Not allowed:** "🚨 STOP SCROLLING", "This changed EVERYTHING", "99% of founders...", "Game changer", excessive emojis, AI clichés.

## Personality

Sound like someone who enjoys solving commercial puzzles. Curious. Occasionally funny. Occasionally brutally honest. Always respectful. Write as someone who has genuinely sat in commercial meetings.

## Length

Most posts 100–220 words. Some 50 words. Some 300 words. Mix the rhythm — don't let every post land at the same length.

## Structure — vary formats, never repeat the same one back-to-back

Stories, observations, frameworks, questions, lessons, diagrams, short essays, myths, mini case studies, commercial truths, lists, one-liners.

## Every post must have a visual

Never publish text-only. Choose whichever format fits: clean branded graphic, simple diagram, commercial framework, flowchart, process illustration, checklist, comparison graphic, quote card, carousel, annotated whiteboard, tasteful AI-generated illustration. The image supports the lesson, it doesn't decorate it. Halo branding throughout.

**Image style:** premium, minimal, professional, white background, French Racing Blue accents, simple typography, executive feel. Think McKinsey / Harvard Business Review / Linear. Not Canva templates.

(Production note: since nobody in this pipeline currently generates final branded images automatically, each post's Markdown file captures an **Image prompt** — a written brief precise enough for a designer or an image-generation tool to execute against this style spec. See the per-post template in `content/linkedin/_TEMPLATE.md`.)

## Core themes to repeatedly reinforce

Diagnosis Before Prescription, commercial clarity, growth bottlenecks, commercial systems, decision making, leadership, sales process, CRM adoption, AI implementation, agency partnerships, founder thinking, commercial confidence.

## Never

Sell aggressively, overpromise, use fake urgency, invent statistics, invent case studies, invent client names, invent outcomes, copy LinkedIn influencers, chase engagement. Every insight should feel earned. This is the same evidence rule as the Insights articles (see `docs/ARCHITECTURAL_DECISIONS.md` and the Editorial Style Guide) — no number or case study appears in a post unless it traces to a real Selected Engagement or the Halo Bible.

## Calls to action

Subtle only. "Explore more thinking: https://halostrategic.com" or "More commercial thinking: https://halostrategic.com." Occasionally: "Curious whether this exists in your business?" Never "Book now." No pressure.

## Weekly themes (rotate continuously)

Monday: Commercial Myth. Tuesday: Selected Engagement. Wednesday: Framework. Thursday: Commercial Pattern. Friday: Founder Lesson.

## Quality test before publishing

Would McKinsey publish this? No — good. Would Halo publish this? Yes. Could another consultancy publish the exact same thing? If yes, rewrite it.

## Long-term goal

After twelve months, Halo Strategic's LinkedIn should read like a public library of commercial thinking. Someone scrolling back through hundreds of posts should conclude: "These people have a coherent philosophy. They don't just sell consulting, they demonstrate how they think."

## Where this lives

- This manual: `docs/LINKEDIN_OPERATING_MANUAL.md` (blocked from public serving, see ADR-014).
- The actual posts: `content/linkedin/{draft,scheduled,published,archived}/`, one Markdown file per post — folder mechanics and the per-post frontmatter spec are in `content/linkedin/README.md`.
- Source material: the 15 published Insights articles, the six named Selected Engagements case studies, and `docs/HALO_BIBLE.md` — the same evidence base as the Insights pipeline, not a separate one.

# Halo Strategic — Evergreen SEO Content Engine

Status: Living document, governs the Insights pipeline going forward. Owner: Claude Code. Written 2026-07-31/08-04 from a brief Fabien provided, adjusted in one material way before approval (cadence) — see ADR-021 for the full reasoning.

## Objective

Turn Halo Strategic into the leading commercial growth resource for founder-led businesses. Not traffic for its own sake — the goal is to attract business owners already experiencing commercial growth problems and position Halo as the consultancy they trust before they ever book a call. Every article should increase topical authority, commercial credibility, organic traffic, founder trust, and Commercial Diagnostic enquiries, in that order of importance.

## Audience

Primary: founder-led businesses (£500k–£20m turnover), marketing agencies, lead-generation agencies, high-ticket B2B service businesses, SaaS companies, commercial directors, managing directors, CEOs, business owners.

Secondary: sales directors, growth leaders, revenue leaders, agency owners, PE-backed SMEs.

## Core philosophy

Every article reinforces Halo's founding belief: most businesses don't have a marketing problem, they have a commercial problem. Every article should move the reader toward thinking commercially rather than tactically — this is the same First Law that runs through How Halo Thinks, Product Journey, and the homepage.

## Tone

Write like a trusted commercial adviser, not an SEO writer, not ChatGPT, not a generic agency. Use evidence, frameworks, observations, practical examples, strategic thinking. Avoid hype, buzzwords, fake urgency, clickbait, AI clichés. This is not a new rule — it's the same voice check already running on every page (see [[feedback_halo_voice_check]]).

## Cadence: 2–3 articles a week, evidence-gated — not daily

Fabien's original brief specified daily publishing toward ~365 articles/year. That was adjusted before approval, and this is the one place this document deliberately diverges from the original brief:

**Why the change:** the evidence standard already running this entire project (see [[feedback_evidence_standard]]) requires every case-specific figure or example to trace to a real, verified Halo engagement. Right now that's exactly 6 Selected Engagements case studies. Daily publishing across the pillars below — several of which touch industries Halo has never actually worked in — would outrun that evidence base within weeks, leaving every article after that point with two options: go generic (the exact "sounds like an SEO writer" failure mode this brief itself warns against), or fabricate specifics (the thing this project has repeatedly refused to do). There's no third option once the real evidence runs out.

**The actual rule:** publish 2–3 articles a week as a ceiling, not a quota. If a week doesn't have 2–3 genuinely evidence-backed, non-generic topics ready, publish fewer that week rather than pad the count. Cadence scales up only as real client work produces new case material to write from — this is a constraint to loosen deliberately later, not a target to hit immediately.

**Precedent worth remembering:** an earlier version of the `halo-article-drafter` scheduled task attempted something close to full automated article production and it broke — it drafted competing full-length articles into a disconnected local folder and duplicated topics the live pipeline had already published. That task is now deliberately scoped to derivatives-only and is read-only against this repo (see its SKILL.md). The new task this document governs (see "Workflow" below) exists specifically to avoid repeating that mistake: draft-only, one canonical pipeline, human review before anything touches the live site.

## Content pillars, reconciled against the existing category taxonomy

`tools/insights-articles.json` already carries a live category field across the 15 published articles. Nine distinct category strings exist today: Leadership & Commercial Decision Support, Commercial Diagnosis & Constraint-Finding (4 articles — currently the most-weighted), Channel Strategy & Media Buying, CRM & Data Trust, Founder Mindset & Growth Misconceptions (2), Commercial Diagnostics & Frameworks (2), Reporting & Decision Systems, Marketing Systems & Vanity Metrics, Agency Partnerships (2). See [[feedback_content_mix_balance]] for the standing balance rule.

Fabien's six proposed pillars map onto this existing taxonomy rather than replacing it:

| New pillar | Maps to existing category, or is net-new |
|---|---|
| Commercial Growth | Commercial Diagnosis & Constraint-Finding / Commercial Diagnostics & Frameworks |
| Founder Challenges | Founder Mindset & Growth Misconceptions |
| Sales Performance | **Net-new.** Closest existing neighbour is Reporting & Decision Systems, but sales-process content (lead response time, qualification, CRM discipline) is genuinely distinct — add as its own category going forward. |
| Marketing Agencies | Agency Partnerships |
| High-Ticket B2B | Cross-cutting, not a standalone category — fold into whichever underlying category the specific article's argument actually belongs to (most will land in Commercial Diagnosis or Sales Performance). |
| AI & Commercial Growth | **Net-new category.** Genuinely nothing published in this space yet. Approach with particular care on the evidence rule — Halo's own AI usage (in this content pipeline, in client dashboards where documented) is fair game; generic "AI is transforming X" claims are not. |

Before drafting the next article, check the current category distribution and favour whichever is underrepresented — same rule as before, now with two new legitimate categories (Sales Performance, AI & Commercial Growth) added to the rotation.

**Industry pages (Property, Manufacturing, Hospitality, Financial Services, Recruitment, etc.) are explicitly out of scope for now.** Halo's 6 real case studies span home-services/construction (ADU building), architecture, in-home care, and international education — not most of the verticals in the original brief's industry-page list. Writing "Commercial Problems in Manufacturing" today would either be generic thinking dressed as vertical expertise, or would need to lean on invented specifics. Revisit once Halo has real engagement history in a given vertical, or write it explicitly as general framework content that doesn't claim sector-specific experience Halo doesn't have.

## SEO standards

Every article: unique title, meta description, H1, H2 structure, internal links (Commercial Diagnostic, Commercial Audit, About, Contact, plus 2–5 related Insights articles), a soft CTA (never a hard sell — the existing pattern already in every published article, e.g. "If that gap sounds familiar, a Commercial Diagnostic is a free, 45-minute way to find out where it actually sits in your business," is the template to keep reusing). FAQ sections are a new addition this document introduces — use the existing `.faq details/summary` CSS pattern already built into `tools/insights-article-template.html` (shared with Commercial Audit's FAQ) rather than inventing new markup. Article/FAQPage JSON-LD schema per Insights article remains an open, not-yet-decided item (see Pending Decisions in docs/ARCHITECTURAL_DECISIONS.md) — do not add schema markup speculatively without a separate decision to do so.

## Workflow

1. A scheduled task (`halo-seo-article-writer`, see ADR-021) drafts one article at a time, 3x/week, following this document and reading `tools/insights-articles.json` for current category balance. Draft-only — it does not touch the live repo, run the generator, or publish anything.
2. Drafts save to `C:\Users\user\Documents\Halo Strategic\09 Editorial & Content Engine\Insights Drafts\`, one file per article, formatted so Fabien can review in 10–15 minutes: title, H1, meta description, category, teaser, FAQ, full body, and a note on which internal links and evidence sources it used.
3. Fabien reviews: adds his own commercial perspective, removes anything generic, confirms voice, confirms every factual claim traces to a real source.
4. Once approved, an interactive Claude Code session (not the scheduled task) adds the entry to `tools/insights-articles.json`, runs `node tools/build-insights.js`, reviews the generated output, adds the URL to `sitemap.xml` and `_redirects`, commits, pushes, and verifies live — the same process already used for every prior article.

## Long-term shape (adjusted framing)

The original brief targeted ~365 articles in 12 months as a fixed goal. That number is dropped in favour of a rate governed by real evidence and genuine category balance: roughly 100–150 articles in a year is a more honest ceiling at 2–3/week, and even that assumes Halo's case-study base grows meaningfully over the same period. The qualitative goal stands as written: when a founder searches for commercial growth, agency profitability, high-ticket sales, or founder bottlenecks, Halo Strategic should consistently appear with genuinely useful, commercially grounded content — earned at a pace the evidence can actually support, not manufactured to hit a number.

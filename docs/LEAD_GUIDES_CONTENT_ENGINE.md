# Lead Guides: SEO content for Halo Lead Exchange

Status: live from 2026-11-19. **Closed to new content from 2026-11-24.** Owner: Claude Code, approved by Fabien ("full approval on how it runs and sits").

## What it is

A section of the main site at `halostrategic.com/lead-guides/`: practical guides for installers who buy homeowner leads (spray foam removal, solar and battery, roofing). Every guide links into Halo Lead Exchange (`/leads-exchange/...`) through its body, a standard call-out box and the footer. The goal is search visibility for lead-buying questions and trust before an installer applies.

Kept separate from `/insights/` on purpose: Insights is consultancy thinking for founders, originally governed by a 2-3/week ceiling (docs/SEO_CONTENT_ENGINE.md), now a daily engine covering both businesses (see that doc's "Cadence update, 2026-11-24"). Lead Guides ran daily because its subject is Lead Exchange's own process, first-hand fact rather than client evidence.

**As of 2026-11-24, Lead Guides takes no new content.** All new SEO content for both Halo Strategic and Lead Exchange is now written through the single daily engine described in docs/SEO_CONTENT_ENGINE.md and published to `/insights`, approved the same way for both businesses: a pull request, merged by Fabien. The weekly writer task that used to add new Lead Guides has been removed. The daily publisher below keeps running only to clear the backlog that was already approved in `tools/lead-guides.json`; once the last currently-queued guide (dated 2026-11-25) is live, that task is disabled and this section stops changing.

## How it runs

1. `tools/lead-guides.json` holds every guide: copy, `publishDate`, `status` (`approved` or `draft`), optional `faq`. No new entries are being added to this file (see above); the existing approved entries are simply publishing out on their scheduled dates.
2. `node tools/build-lead-guides.js` publishes guides that are `approved` and dated today or earlier (UK date). It removes any page that is not, rebuilds `/lead-guides/index.html`, adds related-guide links, and rewrites the marked Lead Guides blocks in `sitemap.xml` and `_redirects`. `--check` validates only; `--date=YYYY-MM-DD` previews a day.
3. **Daily publisher** (scheduled task, every morning UK time): runs the build on `main` and commits and pushes only if something changed. If a run is missed, the next one catches up. This is the only moving part left in this pipeline: once the backlog (last date 2026-11-25) is exhausted, this task is disabled and nothing further publishes here.
4. **Weekly writer** — removed 2026-11-24. It used to write the next 7 guides a week on a branch, approved by merging its pull request. That process no longer runs; the topic backlog below is kept for reference only and is not being worked through.

## Voice and evidence rules (non-negotiable)

- Written for an installer running a real business: plain UK English, practical, honest about trade-offs. No hype, no clickbait, no AI clichés, no fake urgency.
- Claims about Lead Exchange must match what it actually does today (check the app and its published policy pages). Do not quote prices or commercial terms unless Fabien has published them.
- Outside statistics only from named, real sources, attributed in the text (e.g. Harvard Business Review, 2011, "The Short Life of Online Sales Leads"). Never invent a figure, case study, customer or quote. Worked numbers must be labelled illustrative.
- Legal and compliance topics carry a "general information, not legal advice" line.
- Each guide: unique title (ends "| Halo Lead Exchange"), meta description <= 165 chars, H1, 4-7 H2 sections, 2+ links into `/leads-exchange/`, 3 FAQ items, closing link to how-it-works and become-a-buyer.

## Topic backlog (the writer works through these, adding new ones as it goes)

Speed and follow-up: what to say on the first call; text vs call for first contact; following up a homeowner who has gone quiet; evening and weekend response; tracking where leads are lost.
Buying and pricing: cost per job vs cost per lead; how many leads to buy in a first month; judging a supplier in the first 20 leads; why cheap leads can be expensive; capacity planning before you buy.
How Lead Exchange works: postcode coverage and matching; why we ask about your capacity; what happens between enquiry and release; why we confirm with the homeowner before introducing you; payment links and verification.
Lead quality: why we ask about property ownership; researching vs ready-to-buy homeowners; duplicates and how they happen; what a good lead summary includes.
Industry: why homeowners are removing spray foam (surveys, mortgages, ventilation); questions homeowners ask about spray foam removal; solar and battery enquiries in winter vs summer; roofing enquiries after storms. (General, factual, sourced; no claims of sector data Halo does not have.)
Compliance and trust: PECR and calling homeowners; keeping lead data secure; handling a homeowner complaint well; reviews and reputation after a lead.

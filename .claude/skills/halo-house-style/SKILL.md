---
name: halo-house-style
description: House style rules for anything published to halostrategic.com (Insights articles, Lead Guides, site copy). Use before writing or editing any customer-facing copy, and especially before opening a PR for a new article. Covers the no-long-dashes rule and the broader "sounds like a person, not an AI" voice check.
---

# Halo house style: write like a person, not like an AI

This applies to every piece of published copy on halostrategic.com: Insights articles,
Lead Guides, landing pages, FAQs, meta descriptions, everything. It is not optional
and it is not a vibe check you can skip because the content is otherwise good. Fabien
has said directly (2026-11-27) that content reading as AI-generated is a real failure
mode he is actively watching for, separate from whether the facts are accurate.

## Rule 1: no em dashes, no en dashes. Ever.

Never use — (em dash) or – (en dash) anywhere in published copy: titles, H1s, meta
descriptions, teasers, category labels, or body copy. This is one of the most
recognisable "an LLM wrote this" tells, and it is also just not how most people
write in running prose.

Use instead, depending on what the sentence actually needs:

- A comma, when you'd naturally pause: "The gains were real, if modest."
- A period, when it's really two sentences: "The gains were real. They were also
  modest."
- A colon, when the second half explains or expands the first: "The gains were
  real: adoption had doubled in a year."
- A plain hyphen for genuine number ranges or compounds: "3-4 FAQs", "1,000-1,500
  words", "lead-generation agency". A hyphen is not a dash and is fine.

This is enforced mechanically, not just by memory: `node tools/build-insights.js`
scans every field of every article in `tools/insights-articles.json` for U+2014
(em dash) and U+2013 (en dash) and **fails the build** if either appears anywhere.
If you hit that error, find the field it names, rewrite the sentence using one of
the alternatives above, and rebuild. Do not try to work around the check; fix the
sentence.

Before opening a PR for a new article, as part of the usual self-check list, state
explicitly that you grepped the new entry for both characters and found none, the
same way you confirm word count or FAQ count.

## Rule 2: the broader "does this sound like a person wrote it" check

The no-dashes rule is the easiest part of this to check mechanically, but it's a
symptom of a bigger thing: copy that reads as generated rather than written. Before
finishing a draft, read it back and ask whether a commercially literate human
editor would wave it through, or would start marking it up. Concretely, watch for:

- **AI-sounding openers.** "In today's fast-paced business environment...",
  "It's no secret that...", "Let's dive into...". Open with the actual claim or
  observation instead.
- **Empty corporate language and hedge-padding.** "Leverage synergies",
  "robust solution", "it's important to note that", "in conclusion". Say the
  specific thing instead of the generic wrapper around it.
- **Symmetrical triads and rule-of-three padding** ("faster, smarter, and more
  efficient") used as filler rather than because three real things are being
  listed. If you're reaching for a third item just to complete the pattern,
  cut it.
- **Over-hedged, nobody-home prose.** Real writers commit to a claim and then
  defend it with evidence; they don't wrap every sentence in "may potentially
  help to" qualifiers. State the position, cite the source, move on.
- **Perfectly balanced paragraph lengths and a sing-song rhythm.** Real written
  English varies: a short sentence after a long one, a paragraph that's three
  lines next to one that's eight. If every paragraph is suspiciously the same
  shape, vary it.
- **Summarising what you just said instead of ending.** "In summary, AI adoption
  is rising but impact lags" at the end of a piece that already made that point.
  End on the actual last thought, not a recap.

None of this is about being clever for its own sake. It's the difference between
copy a founder reads and trusts, and copy they skim past because it smells like
every other AI-assisted blog post in their feed, which is the opposite of what
Halo Strategic and Halo Lead Exchange content is for.

## How this fits the editorial pipeline

`docs/SEO_CONTENT_ENGINE.md` already sets the voice bar ("write like a trusted
commercial adviser, not an SEO writer, not ChatGPT, not a generic agency") and the
specific no-em-dash line under Tone. This skill exists so that bar has somewhere
concrete to point to, with the actual mechanical check and the longer list of
tells, rather than relying on a single sentence being remembered correctly by
every future run. Read this file, in addition to `docs/SEO_CONTENT_ENGINE.md`,
before drafting or editing anything that will be published.

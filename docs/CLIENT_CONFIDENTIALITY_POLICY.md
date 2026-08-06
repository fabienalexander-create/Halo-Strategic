# Client Confidentiality Policy for Third-Party-Derived Content

**Status:** Draft v0.1, started 2026-08-06. Not yet a frozen document like `docs/HALO_BIBLE.md` — this needs Fabien's sign-off, and ideally a check against his actual written agreements with GQL and his second US agency client, before it governs any real publishing decision.

## Why this exists

Fabien does ongoing consulting work with two US-based marketing agencies (referred to internally as "GQL" and a second, unnamed one — see `docs/ARCHITECTURAL_DECISIONS.md` and the About page). Through that work he's exposed to real commercial situations at businesses that are not Halo's own clients — GQL's clients, GQL's own internal decisions, or the second agency's. Separately, Fabien proposed turning "everything I'm learning every week" into Halo's content and intellectual property.

Those two things are in real tension. Halo's evidence standard (`docs/HALO_BIBLE.md` Chapter 6, "we will not sell certainty where certainty doesn't exist," and the site-wide rule never to invent a figure) already governs Halo's *own* Selected Engagements case studies, which have their own established anonymisation practice and, presumably, are covered by whatever agreement Halo has with its own clients. **This document does not cover that** — Selected Engagements keep working exactly as they do today. This document covers the separate, harder question: content derived from Fabien's work *for* GQL or the second agency, about situations that belong to *their* clients or to them.

## The unresolved question, stated plainly

This policy defines an editorial process for what's safe to publish. It cannot answer whether Fabien is *contractually* allowed to publish anything derived from that work at all, at any level of genericisation. That depends on the actual written agreement (consulting contract, NDA, non-compete, IP-assignment clause) Fabien has with GQL and the second agency, which no one drafting this document has seen. **Before this policy governs a single real publishing decision, Fabien should check his own agreements for an explicit confidentiality or non-disclosure clause** — some consulting contracts prohibit using any work-product or derived insight publicly, at any level of abstraction, without written client consent, which would override everything below. This document assumes no such blanket prohibition exists; if one does, it takes precedence and this document needs revising, not the other way round.

## The absolute rule — no exceptions, no editorial judgement required

**"GQL," the second agency's name, and the name of any of their clients must never appear in anything published anywhere — the website, LinkedIn, frameworks, PDFs, lead magnets, speaking material, anywhere.** This isn't part of the genericisation judgement call below; it's a hard filter that applies before that process even starts. Even in a sentence that's otherwise fully generic and would pass both recognition tests, the name itself is still not permitted. This document itself lives in `docs/`, which is blocked from public serving (`_redirects`, ADR-015) — that's why it's safe to reference "GQL" here for internal clarity, but that internal use is not license to use it anywhere the confidentiality question in this document actually governs.

## The core rule

**Every insight must pass two tests before it's published anywhere — the site, LinkedIn, a framework, anywhere — not just a general sense of caution:**

1. **The Client Recognition Test.** Could the specific client (or business) the observation came from recognise themselves in it?
2. **The Third-Party Recognition Test.** Could someone who knows that client's business — a competitor, an employee, another vendor, GQL's own account team — recognise the client from the description, even if the client themselves never reads it?

Test 2 is the stricter one and the one most likely to be missed, because it's easy to check "would the client notice" and forget that other people who know the client's situation are reading Halo's content too. If either test fails, don't publish — genericise further or drop it.

## The process: from a real observation to a publishable line

Adapted directly from Fabien's own instruction:

1. **Observation** — something noticed in the work, stated first exactly as it happened, including anything identifying. This step is private, never published, never even drafted into a file outside this process.
2. **Strip the identifying layer.** Remove the client name, the specific business, the specific numbers, the specific timing, the specific industry if it's a small enough industry to be identifying on its own, and any combination of details that together would work like a fingerprint even if no single detail does alone.
3. **Generalise to the pattern.** State the underlying commercial principle as something true across multiple businesses, not a description of one event.
4. **Run both recognition tests** against the generalised version, not the original observation.
5. **Only then does it become a Halo observation** — publishable as Halo's own thinking, not attributed to or traceable to GQL, the second agency, or any specific client.

**Fabien's own worked example**, which is the calibration reference for every future case:

> ❌ "NRG increased spend." — a specific, attributable fact about a specific business.
>
> ✅ "Businesses often pause budget increases during major system migrations because clean data is more valuable than faster scaling." — the underlying commercial principle, true across many businesses, with nothing left that traces back to one.

## Hard exclusions — fails the test automatically, no genericisation saves it

- **Anything not yet public.** An unannounced strategy shift, an upcoming personnel change, unreleased financials, a deal in progress. Genericising the wording doesn't fix a timing leak — if it's published close enough to the real event, insiders will connect it regardless of how the sentence is worded.
- **Anything published close in time to the real event.** Even a fully genericised observation can be re-identified if it lands on Halo's site or LinkedIn within days of something the client would recognise happening in their own business. Consider a deliberate delay for anything with a plausible time-correlation risk.
- **Combinations of otherwise-generic details.** Industry + company size + specific timing + specific problem, even with no names, numbers, or direct quotes, can still be a fingerprint. Test the combination, not just each detail in isolation.
- **Direct or near-direct quotes** from a meeting, an email, or a client conversation, even unattributed. Paraphrase into the underlying principle; never lift the actual sentence someone said.

## Approval gate

Every insight in this category gets Fabien's explicit review and sign-off before it's published — no exceptions, and no automated scheduled task (`halo-seo-article-writer`, `halo-article-drafter`) should ever touch this category or be given access to any raw meeting notes. This is different from, and stricter than, the existing Insights review process, which already requires his review but is grounded in Halo's own verified case studies rather than a third party's confidential work. If a draft observation is even borderline on either recognition test, the default is **don't publish**, not "publish and see."

## Open items

- Fabien to confirm whether his actual agreements with GQL and the second agency contain a confidentiality or non-disclosure clause that overrides or narrows anything above.
- No workflow yet exists for step 1 (capturing the private, pre-genericised observation) — this document assumes that happens in Fabien's own notes, not in this repository or any Claude session, until it's already through step 4.
- This document is a starting draft, not yet cross-referenced into `docs/HALO_BIBLE.md` or `docs/AI_OPERATING_MODEL.md`. Once Fabien confirms the contractual question above, it should either be formally adopted (and referenced from those documents) or revised.

# Email Outbound Campaign — Brief for Claude

Status: Brief only, not built. Written 2026-09-05 for a future session to execute, likely next week. Nothing in this brief has been built yet: no tool account, no sequence copy, no list segmentation. This is the starting brief, equivalent in spirit to the original LinkedIn campaign brief that became `docs/LINKEDIN_LEAD_GEN_CAMPAIGN.md`, written before any of that was built.

## 0 — What this is, and isn't

This is cold-to-warm outbound to people Fabien has a genuine past professional relationship with (former clients, prospects, contacts from his agency years), not a purchased or scraped list. That distinction matters and should govern every decision below: this is closer to a founder reconnecting with his own network at scale than to cold prospecting a stranger database. The copy, cadence and tool choice should all reflect that, not treat it as anonymous cold outbound.

## 1 — Don't use Mailchimp

Mailchimp's terms prohibit sending to purchased or non-opt-in lists and are built for bulk newsletter delivery to people who signed up through a form, not for personalized, sequenced outbound. Sending this list through Mailchimp risks account suspension and, worse, burns Halo's sending domain reputation in the process.

Use a cold-email / sales-engagement tool instead: **Instantly**, **Apollo**, or **Lemlist** are the right category, each handling personalized sequencing, reply detection, and (critically) domain warmup and daily send-limit throttling. Pick one; don't evaluate all three from scratch, any of the three will do the job. Instantly is the simplest starting point if no strong preference exists.

## 2 — Compliance, stated plainly rather than assumed

UK PECR treats marketing email to a limited company's business address more permissively than to a sole trader, partnership, or personal address (the "corporate subscriber exemption"), but GDPR's legitimate-interest basis still applies to processing the contact's personal data, and every message needs real sender identity and a working, honoured opt-out.

Because this list is genuine past-relationship contacts, not a bought database, legitimate interest is a defensible basis, but the brief for whoever builds this should say so explicitly rather than let default cold-outbound copy (which usually assumes zero prior relationship) get used unchanged. Practical requirements for whatever gets built:

- Real "why you're hearing from me" framing in the first line, grounded in an actual prior connection, not a generic "I came across your business" opener that would be dishonest for a list built this way.
- A working unsubscribe / opt-out in every email, honoured immediately, not just present as boilerplate.
- Real sender identity (Fabien's name, halostrategic.com), never a disguised or spoofed from-address.
- No claims about the recipient's business that Fabien can't actually back up ("your website is losing you money") for people he doesn't have specific evidence about, consistent with the same evidence discipline used everywhere else in this repo (`docs/HALO_BIBLE.md` Chapter 6).

## 3 — Deliverability setup (do this before any sending)

- **Use a separate sending domain**, not `halostrategic.com` directly (e.g. a variant like `halostrategic-mail.com` or similar, forwarding to the same inbox), so a deliverability problem during warmup or a spam-complaint spike doesn't damage the domain the main website and its email run on.
- **Warm up the new domain/mailbox for 1-2 weeks** before real sending starts, most cold-email tools handle this automatically once configured, but it needs to be turned on early, not skipped to hit a "next week" deadline.
- **Start small**: 20-30 emails/day per mailbox to begin, ramping up gradually. Sending the full list in week one is the single most common way this kind of campaign gets flagged as spam and kills its own deliverability before it starts.

## 4 — Segmentation

Not every contact in "past work" is the same kind of relationship. Before writing any copy, the list needs at least a rough split:

- **Tier 1 — real relationship**: people Fabien worked with directly, would recognise his name immediately, genuinely warm.
- **Tier 2 — adjacent/prospected before**: people he pitched or was introduced to but didn't necessarily close, weaker but real connection.
- **Tier 3 — thin/uncertain**: anyone where the "genuine relationship" claim is a stretch. Worth being honest about how many contacts actually fall here before assuming the whole list qualifies as warm outbound rather than cold.

Different tiers likely warrant different opening lines (Tier 1 can reference the actual past work directly; Tier 3 needs more care not to overclaim familiarity). This split should happen before copy is written, not be improvised per email.

## 5 — Copy principles

Same standard as everywhere else in this repo, not a separate voice for outbound:

- No invented results, no invented urgency, no em dashes (Halo's own editorial standard, see `docs/LINKEDIN_OPERATING_MANUAL.md`).
- Lead with the actual reason Fabien is reaching out to this specific person, not a generic template with a mail-merge name dropped in.
- Halo's positioning stays consistent: commercial diagnosis before prescription, not "check out my new consultancy" self-promotion. The ask should be a conversation, not a hard pitch, consistent with how Halo talks about itself in `docs/HALO_BIBLE.md`.
- Short. Cold/warm outbound email dies in the second paragraph; this isn't a LinkedIn post or an Insights article.

## 6 — Sequence structure (starting point, not final)

A simple 3-touch sequence over roughly two weeks is a reasonable starting shape: an opener referencing the real prior connection, a short follow-up a few days later if no reply, and a final brief "should I stop reaching out" close. Exact timing and number of touches is a decision for whoever builds this, informed by how the chosen tool's defaults work, not fixed here.

## 7 — Tracking

Same discipline as the LinkedIn campaign's qualified-lead tracker (`content/ads/linkedin-website-review/qualified-lead-tracker.xlsx`): opens and clicks are vanity metrics on their own, what matters is replies, conversations booked, and opt-outs (a high opt-out rate on a supposedly warm list is a real signal something's off with the tiering or the copy, not something to ignore). Whoever builds this should set up an equivalent simple tracker rather than relying on the sending tool's own dashboard alone.

## 8 — What needs deciding before a build session can actually start

- Which tool (Instantly / Apollo / Lemlist), and whether Fabien already has a preference or account
- Real size of the contact list, and how it splits across the three tiers in §4
- Whether a separate sending domain is already registered or still needs setting up (this has lead time, needs doing before warmup can even start)
- Confirmation that every contact on the list genuinely fits the "past working relationship" framing in §0, since the compliance reasoning and the copy both depend on that being true, not assumed

## 9 — What "next week" realistically allows

Domain warmup alone takes 1-2 weeks before real sending should start. If the domain isn't already set up, "sending real emails next week" and "protecting deliverability properly" are in direct tension, worth deciding now which one gives, rather than discovering it mid-build.

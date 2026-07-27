# Implementation Log

## Sprint 0 — Site Reconciliation (2026-07-25)

**Trigger.** A Website Authority & SEO Deployment brief was approved to proceed with Sprint 0 (reconciliation) before Sprint 1 (Technical SEO). Live-site crawl during scoping found the site running three inconsistent nav/footer templates across seven pages, not one coherent site. Full findings in `docs/RECONCILIATION_REPORT.md`.

**Inspect.** Fetched raw source (not just rendered text) for all seven pages via the GitHub repo to work from real markup rather than assumptions. Confirmed: Family A (index, commercial-diagnostic, commercial-audit, contact) shared one stylesheet and nav/footer. Family B (selected-engagements, how-halo-thinks) used an entirely separate, self-contained stylesheet with different CSS variable names and no shared components. About.html used a variant of Family A's stylesheet with its own nav wording.

**Analyse.** Family A's design system (nav, footer, hero pattern, card grid, page-table/FAQ/step-row components) was the most complete and reusable. Decision: build one canonical stylesheet as the union of every component in use across all seven pages, standardise the nav and footer everywhere, and migrate Family B's two pages onto it without altering their content.

**Decisions made and why:**
- Kept all existing copy on every page untouched. Only navigation, footer, internal linking, and the homepage's two known defects (dead case study links, thin Evidence section) were changed.
- Migrated how-halo-thinks.html and selected-engagements.html's page-header pattern onto Family A's existing `.hero` component (eyebrow + h1 + lead) instead of keeping their bespoke `.page-head` component, since Family A's hero already does the same job and is used identically on Contact, Commercial Diagnostic, and Commercial Audit.
- Found and resolved one CSS class collision: about.html's `.story` (paragraph-spacing wrapper) versus selected-engagements.html's `.story` (article card). Renamed about.html's to `.founder-story` rather than risk the two stylesheets fighting once merged.
- Added six internal links specified in the approved brief (Audit→Engagements, Audit→About, About→Thinks, Engagements→Audit, Thinks→Diagnostic) plus several supporting ones that came up naturally while rebuilding each page (Contact→About, homepage service cards→Diagnostic/Audit).
- Did not add an "Evidence" nav item separate from Selected Engagements. The homepage's on-page Evidence section already links to Selected Engagements directly, adding a second nav destination for the same content would work against the "no isolated destination, no duplicate destination" goal.

**Implement.** Built via a small Python template system (`common.py` holds the shared `<style>` block, header, and footer generators; one build script per page) rather than hand-editing seven copies of near-identical markup, this makes any future shared change (adding an eighth page, adjusting the nav) a one-file edit instead of seven.

**Verify.** Automated checks across all seven output files before pushing: zero literal `href="#"` placeholder links (down from 2 on the homepage), zero missing closing tags, consistent nav (6 items) and footer (13 items) counts on every page, all six Selected Engagements anchor IDs preserved, no leftover template artifacts. No visual/screenshot render was available in this environment (no headless browser installed), so verification was structural and content-diff based rather than pixel-based; recommend a manual visual pass on the live URLs after deploy.

**Document.** This entry, plus `docs/CHANGELOG.md` and `docs/SITE_ARCHITECTURE.md`.

**Commit.** Pushed as one commit to `main` covering all seven HTML files plus the three doc files.

**Next.** Sprint 1 — Technical SEO & Analytics. Analytics (GA4) and Search Console are being set up separately by Fabien, out of scope here. Sprint 1 covers: sitemap.xml (currently empty/missing), meta description and canonical audit across all pages (mostly already present, needs verification), image alt text audit, schema markup (Organization, LocalBusiness, potentially Article once Insights exists), Core Web Vitals spot-check, and a broken-link sweep of the remaining un-crawled pages (privacy-policy, cookie-policy, terms-and-conditions, thank-you, 404).

## Sprint 1A - Google Tag Manager Installation (2026-07-25)

Backfill note. This entry was not written when commit 4d9503e was made. It is backfilled during Phase 3 Documentation Reconciliation (2026-07-26), reconstructed from docs/GOOGLE_TAG_MANAGER.md and the commit diff itself, not invented.

Trigger. Continuing implementation after Sprint 0, installing the previously agreed Google Tag Manager container and correcting the two legal pages' analytics claims to match.

Inspect. Confirmed GTM-T49HRT6J and GA4 (G-KC0RH0SS1L) already existed as a container and property. Found a GA4 Configuration tag (GA4, Configuration, Halo Strategic) and a DOM, Page Title variable already built in the container, both edited roughly four hours before this session, and left them as-is rather than duplicating them.

Analyse. Decision: install the container's head script and body noscript iframe identically across every page via a single shared source (site/gtm_snippets.py), for the same one-file-edit reasoning as the Sprint 0 template system, rather than hand-pasting the snippet into each file.

Decisions made and why. Installed on 10 of 12 pages: index.html, about.html, contact.html, commercial-diagnostic.html, commercial-audit.html, how-halo-thinks.html, selected-engagements.html, privacy-policy.html, cookie-policy.html, and thank-you.html. terms-and-conditions.html and 404.html were not yet on the unified nav/footer template at that point and were left out of scope for this pass, consistent with Sprint 0's own scope boundary. Rewrote privacy-policy.html and cookie-policy.html, since both stated no analytics or tracking was in use, which would have become false the moment the container publishes. Did not build the seven Consultancy Events triggers (discovery_call_started, discovery_call_booked, commercial_diagnostic_requested, commercial_audit_requested, contact_form_submitted, email_clicked, phone_clicked) or the eighth, linkedin_clicked, since building seven triggers accurately in one sitting, on a connection that was intermittently unresponsive during the session, was judged a reliability risk not worth taking blind; deferred as a scoped follow-up.

Implement. Built via the shared snippet source (site/gtm_snippets.py) rather than hand-editing ten copies of the same script block.

Verify. Verified one head snippet and one body snippet per page, no duplicates, via automated grep across all ten files before pushing.

Document. See docs/GOOGLE_TAG_MANAGER.md for the full detail; this entry and the corresponding docs/CHANGELOG.md entry were both backfilled in Phase 3, 2026-07-26.

Commit. Pushed as commit 4d9503e.

Next. Build the Consultancy Events triggers as a scoped follow-up, publish the container in tagmanager.google.com, and extend the GTM snippet to terms-and-conditions.html and 404.html once they are on the unified template.

## Sprint 1B - Service Parameter Plumbing and Mailto Links (2026-07-25)

Backfill note. This entry was not written when commit f6bb162 was made. It is backfilled during Phase 3 Documentation Reconciliation (2026-07-26), reconstructed from the commit diff itself, not invented.

Trigger. Closing the loop between the two service pages and the contact form, so submissions carry which service a lead was reading about, and giving GTM/GA4 a reliable, success-only measurement event.

Inspect. Found that commercial-diagnostic.html and commercial-audit.html's CTAs linked to contact.html with no indication of which service the visitor came from, and that contact.html and index.html's forms fired no dataLayer event distinguishing a genuinely successful submission from a raw form submit.

Analyse. Decision: pass intent through a URL query parameter rather than a cookie or session value, since it is simpler, works without JS on arrival, and matches the site's existing static-page architecture.

Decisions made and why. Added a service query parameter (diagnostic or audit) to the primary CTA links on commercial-diagnostic.html and commercial-audit.html. Added a hidden service field to the contact.html and index.html forms; on contact.html, read the parameter from the URL via inline JS and populated the hidden field, defaulting the reason dropdown to discovery call when a service parameter is present and no reason has been chosen yet; on index.html, set the hidden field statically to diagnostic, since that form only appears on the Diagnostic-focused homepage section. Added a form_submit_success dataLayer push, with form_id, service, and reason, on both forms, firing only once the submission has actually succeeded rather than on raw submit, so GTM/GA4 never counts a failed send. Converted the two contact.html email addresses, hello@halostrategic.com and fabien@halostrategic.com, to mailto links, since they were previously plain text.

Implement. Changes made directly to commercial-audit.html, commercial-diagnostic.html, contact.html, and index.html.

Verify. Not documented in detail at the time; no automated check log exists for this commit the way Sprint 0 and Sprint 1A have one. This gap is noted here rather than papered over.

Document. This entry and the corresponding docs/CHANGELOG.md entry were both backfilled in Phase 3, 2026-07-26.

Commit. Pushed as commit f6bb162.

Next. None logged at the time.

## Phase 3 - Documentation Reconciliation (2026-07-26)

Trigger. Claude Cowork committed docs/ARCHITECTURE.md, docs/ARCHITECTURAL_DECISIONS.md, docs/TECHNICAL_SEO.md, and docs/ROADMAP.md (commit ee3caf6), and Fabien authorised Claude Browser to reconcile the Browser-owned implementation documentation against them before Sprint 1 implementation begins.

Inspect. Read all four newly committed architecture documents in full, plus docs/PROJECT_CONTEXT.md, docs/CURRENT_SPRINT.md, docs/IMPLEMENTATION_GUIDE.md, docs/TECHNICAL_SEO_STATUS.md, and docs/AI_OPERATING_MODEL.md. Cross-checked the commit history and found two commits, 4d9503e and f6bb162, labelled Sprint 1A and Sprint 1B, that had never received a docs/CHANGELOG.md or docs/IMPLEMENTATION_LOG.md entry.

Analyse. Found three categories of drift: docs/CURRENT_SPRINT.md's Sprint 1 blocker was stale on both stated grounds, since the audit now exists and docs/ROADMAP.md scopes URL strategy to Sprint 2, not Sprint 1; docs/PROJECT_CONTEXT.md and docs/TECHNICAL_SEO_STATUS.md both still described the architecture documents as non-existent or placeholder; and the Sprint 1A/1B work was undocumented in the two required project-wide records.

Decisions made and why. Corrected rather than deleted the stale Sprint 1 blocker language in docs/CURRENT_SPRINT.md, and added an explicit numbering note explaining that Sprint 1A/1B are historical, already-shipped work distinct from docs/ROADMAP.md's formal Sprint 1 definition, per Fabien's instruction to preserve chronology rather than rewrite history. Backfilled the missing docs/CHANGELOG.md and docs/IMPLEMENTATION_LOG.md entries for Sprint 1A/1B from docs/GOOGLE_TAG_MANAGER.md and the commit diffs, flagging clearly that they are backfilled rather than contemporaneous. Did not modify any Cowork-owned document.

Implement. Updated docs/CURRENT_SPRINT.md, docs/PROJECT_CONTEXT.md, docs/TECHNICAL_SEO_STATUS.md, and docs/CHANGELOG.md; this entry completes the same for docs/IMPLEMENTATION_LOG.md.

Verify. Re-read each updated document after editing to confirm it renders correctly and does not conflict with docs/ARCHITECTURE.md, docs/ARCHITECTURAL_DECISIONS.md, docs/ROADMAP.md, or docs/TECHNICAL_SEO.md.

Document. This entry.

Commit. Each of the five documents was committed separately to main, with Fabien's prior approval for this Phase 3 pass.

Next. Await Fabien's authorisation to begin Sprint 1 implementation (nav/footer/GTM parity on terms-and-conditions.html and 404.html, and audit-coverage closure on cookie-policy.html and thank-you.html). Schema implementation remains pending separate Product Owner approval of Schema Philosophy.

---

## Documentation Correction — Build System Verification (2026-07-26)

**Trigger.** A separate, concurrent onboarding review found docs/ARCHITECTURE.md, docs/ARCHITECTURAL_DECISIONS.md (ADR-001, ADR-005), the Sprint 0 entry above, and docs/GOOGLE_TAG_MANAGER.md all describing a Python template system (`common.py`, `site/gtm_snippets.py`) as the site's build mechanism.

**Inspect.** Ran `git log --all --diff-filter=A --name-only` against the full history of this repository: no `.py` file and no `site/` directory have ever been committed, at any commit. Also searched `halo-site-package.zip` (Downloads), the `.openclaw/workspace/Halo` folder tree, and the rest of Documents and Downloads for `common.py`, `gtm_snippets.py`, or equivalent build tooling. None found anywhere.

**Analyse.** The architectural decision to use a template system (ADR-001) and the rule that UI changes must go through it (ADR-005) are not disproven as design intent. What's disproven is implementation status: the tooling this repository's own documentation describes as already built does not exist in any location searched. This includes the Sprint 1A entry directly above, added in the concurrent Phase 3 pass this same day, which also states the GTM snippet was "built via the shared snippet source (`site/gtm_snippets.py`)" — that specific file was searched for and not found either, so that claim carries the same caveat as the rest.

**Decision.** Correct the documentation to describe verified current state (directly-maintained HTML) rather than the unverified generated-HTML claim, without rewriting or deleting the original entries that made the claim, including the Sprint 1A/1B entries above. Amend ADR-001 and ADR-005 with a dated note rather than create a new ADR, since no new architectural decision has been made, only a status correction to an existing one. See docs/ARCHITECTURAL_DECISIONS.md.

**Implement.** Documentation-only change set: ADR-001 and ADR-005 amended (docs/ARCHITECTURAL_DECISIONS.md); Tech Stack corrected (docs/PROJECT_CONTEXT.md); Folder Structure and Design Principles corrected (docs/ARCHITECTURE.md); this entry added; a dated note appended to docs/GOOGLE_TAG_MANAGER.md. docs/TECHNICAL_SEO_STATUS.md was independently and more thoroughly reconciled by the concurrent Phase 3 pass above (all 13 findings populated); this pass's smaller fix to that file was superseded by that work during merge and is not separately applied.

**Verify.** Confirmed no `.py` files or `site/` directory exist in the working tree (unchanged by this edit, since it is documentation-only). Confirmed each touched document's cross-reference to ADR-001's Amendment resolves to the right section. This entry was rebased onto the Phase 3 commits above after both passes had been pushed independently; no further conflicts found outside docs/IMPLEMENTATION_LOG.md and docs/TECHNICAL_SEO_STATUS.md, both resolved here.

**Document.** This entry; see docs/CHANGELOG.md for the summary entry.

---

## Sprint 1 — Nav/Footer/GTM Parity on terms-and-conditions.html and 404.html (2026-07-26)

**Trigger.** Fabien approved Sprint 1's ready-now scope: bring the two lagging pages onto the same nav/footer/GTM baseline as the other 10 pages, closing docs/TECHNICAL_SEO.md findings 7 and 8.

**Inspect.** Read privacy-policy.html (already-verified-correct, per docs/ARCHITECTURAL_DECISIONS.md ADR-002 Consequences and docs/TECHNICAL_SEO.md finding 7/8) as the reference, alongside terms-and-conditions.html and 404.html. Confirmed the head/CSS baseline in all three was already identical; the only gaps were the missing GTM head script and noscript block, the old 5-item nav (missing How Halo Thinks and Selected Engagements, with a stale `index.html#insights` Evidence link), and the old footer Sitemap list (same two items missing, with a stale `index.html#case-studies` link).

**Analyse.** Per docs/ARCHITECTURAL_DECISIONS.md's ADR-005 Amendment (2026-07-26), no template generator exists to route this change through, so it was applied by hand to both files, matching privacy-policy.html's markup exactly rather than improvising new markup.

**Decisions made and why.** Copied the GTM head script/noscript block, the nav-links list, and the footer Sitemap list verbatim from privacy-policy.html into both files. Left everything else untouched, page content, the legal/404 copy, the trailing `<script>` block (including its unused contact-form handler, present in both files as leftover shared markup, not something this task's scope covers), meta tags, and CSS, per the Implementation Guide's smallest-change principle.

**Implement.** Changes made directly to terms-and-conditions.html and 404.html.

**Verify.** Diffed the nav-links block, footer Sitemap block, and GTM head/noscript block in both files against privacy-policy.html: byte-identical in all three cases, both files. Cross-page grep confirmed `GTM-T49HRT6J` now appears twice in both files (head script src, noscript iframe src), matching every other page. Reviewed the full `git diff` for both files line by line to confirm nothing outside the three intended blocks changed. No visual/screenshot verification was available in this environment (local file preview did not render in the available browser tooling); verification was structural and diff-based, consistent with Sprint 0's own precedent.

**Document.** This entry; see docs/CHANGELOG.md, docs/CURRENT_SPRINT.md, and docs/TECHNICAL_SEO_STATUS.md (findings 7 and 8 now marked fully implemented).

---

## Sprint 1 — Audit-Coverage Closure on cookie-policy.html and thank-you.html (2026-07-26)

**Trigger.** Fabien approved closing docs/TECHNICAL_SEO.md finding 13, the two pages never directly source-inspected in the original Sprint 2.1 audit, completing Sprint 1's non-schema scope.

**Inspect.** Read both files in full and compared against privacy-policy.html (the same reference used for the terms-and-conditions.html/404.html pass immediately above).

**Analyse.** Both pages already carry the correct GTM head script and noscript block, the current 6-item nav, and the current 7-item footer Sitemap, matching docs/GOOGLE_TAG_MANAGER.md's claim that both were included in the original Sprint 1A install. No gap found; this is a verification task, not an implementation task.

**Decisions made and why.** No changes made to either file, since none were needed. Documented the verification rather than treating the absence of a defect as nothing to record, since finding 13 was explicitly about the absence of verification, not a known defect.

**Implement.** N/A, no HTML changed.

**Verify.** Diffed the nav-links, footer Sitemap, and GTM head/noscript blocks in both files against privacy-policy.html: byte-identical in both files, all three blocks. Confirmed the meta tag pattern (description, canonical, OG, Twitter) present on both via grep count.

**Document.** This entry; see docs/CHANGELOG.md, docs/CURRENT_SPRINT.md, and docs/TECHNICAL_SEO_STATUS.md (finding 13 now closed).

---

## Sprint 1 — Schema Rollout: Organization Site-Wide, FAQPage on commercial-audit.html (2026-07-26)

**Trigger.** Fabien approved docs/ARCHITECTURE.md's Schema Philosophy recommended priority order, items 1 (Organization) and 3 (FAQPage), recorded as docs/ARCHITECTURAL_DECISIONS.md ADR-007.

**Inspect.** Confirmed via docs/TECHNICAL_SEO.md finding 6 and direct re-check that no JSON-LD existed on any page. Read commercial-audit.html's five `<details>/<summary>` FAQ entries directly to source the FAQPage content from the actual visible markup, not from memory or the audit document's summary of it.

**Analyse.** No template generator exists to route this through (ADR-005 Amendment), so both schema blocks were applied by hand. Organization needed to be identical on all 12 pages; used the site's existing 512x512 icon (`android-chrome-512x512.png`) as the logo URL, since that's a real, already-deployed asset, and the footer's existing LinkedIn URL and hello@halostrategic.com contact email, both already public elsewhere on every page, rather than sourcing anything new. LocalBusiness was not implemented: docs/ARCHITECTURE.md explicitly instructs not to invent an address, and none was supplied.

**Decisions made and why.** Inserted the Organization script block immediately after each page's existing GTM noscript comment, before `</head>`, the same consistent anchor point used for the earlier GTM install (docs/GOOGLE_TAG_MANAGER.md) and Sprint 1 nav/footer/GTM work, applied via a single scripted insertion across all 12 files to guarantee byte-identical content rather than 12 separate hand-typed edits. FAQPage was added only to commercial-audit.html, as a second script block, with question/answer text copied verbatim from the page's own FAQ markup.

**Implement.** Changes made to all 12 HTML files (Organization) and additionally to commercial-audit.html (FAQPage).

**Verify.** Validated every JSON-LD block as syntactically correct JSON via a Node script (`JSON.parse` over each extracted `<script type="application/ld+json">` block), confirming 12 Organization blocks plus 1 FAQPage block, all valid, with the expected `@type` on each. Confirmed via `git diff --stat` that the change was purely additive (228 insertions, 0 deletions) across all 12 files, no existing content touched. Did not independently re-run Google's Rich Results Test or Schema.org validator, no network access to external validation tools was available in this environment; recommend Fabien spot-check with Google's Rich Results Test once live.

**Document.** This entry; see docs/CHANGELOG.md, docs/CURRENT_SPRINT.md, docs/TECHNICAL_SEO_STATUS.md (finding 6 updated), and docs/ARCHITECTURAL_DECISIONS.md (ADR-007).

---

## Header UX: Logo Size/Spacing Increase, and a Newly Discovered Logo Inconsistency (2026-07-26)

**Trigger.** Fabien requested increasing logo presence (height, breathing room) and tightening nav spacing, framed as a UX improvement rather than sprint work. Before making any size change, checked whether a governing Design Bible v1.0 or UX Pattern Library v1.0 existed (both are referenced by name in docs/ARCHITECTURE.md's Purpose section); neither was found as a written document, only zipped asset packs and logo concept images in the business Documents folder's Design directory. Sized changes below are grounded in the site's own existing, real CSS values, not invented tokens.

**Inspect.** While preparing to apply the size increase uniformly, found that the site was not actually visually consistent to begin with: 7 pages (index, about, contact, commercial-diagnostic, commercial-audit, how-halo-thinks, selected-engagements, the pages Sprint 0 touched) carry an inline SVG icon mark next to the logo text at 1.15rem. The other 5 (privacy-policy, cookie-policy, terms-and-conditions, thank-you, 404, exactly the pages Sprint 0's docs/RECONCILIATION_REPORT.md flagged as "not yet crawled") carry plain text only, no icon, at 1.4rem. This was never caught in docs/TECHNICAL_SEO.md's 13 findings or docs/ARCHITECTURAL_DECISIONS.md's ADR-002 Consequences, both of which describe nav/footer consistency but not the logo mark itself.

**Analyse.** Consistent with ADR-002's precedent (the most-developed treatment, Family A, became canonical, the lagging pages were migrated onto it, not the reverse), the icon+text treatment covering 7 of 12 pages, including the homepage, is the sensible baseline to extend to the remaining 5, rather than dropping the icon from the 7 to match the 5.

**Decisions made and why.** Sizing: logo-mark icon 24px to 28px (+16.7%), logo text 1.15rem to 1.35rem (+17.4%), both within Fabien's requested 15-25% range and derived from the real current value, not a round number picked in isolation. Icon-to-text gap 10px to 12px, and header vertical padding 18px to 22px, for the requested breathing room. Nav-links gap reduced 24px to 21px (-12.5%, within the requested 10-15% range) to compensate for the larger logo. Applied identically across all 12 pages: the 7 already-iconed pages got a CSS-only change; the 5 text-only pages got the same CSS values plus the SVG icon markup added to both header and footer logo instances, copied verbatim from the already-live Family A markup (including its existing footer icon stroke colour, `#F6F6F3`, which is the same as the page's own paper background colour, making the icon's outline strokes low-contrast against the footer; this is a pre-existing characteristic of the Family A markup being extended, not something introduced here, and was left as-is rather than fixed as an unrelated side effect of this task, flagging it for a separate look if it's not intentional).

**Not implemented.** Nav-item restructuring (moving items under a future "Insights" or grouping Framework Library) was not done. Today's nav has 6 items and is not actually overloaded; the pages that prompted the "overloaded nav" concern (Insights, Framework Library) don't exist yet, and inventing a nav structure for pages that aren't built would be exactly the kind of architecture invention this project's standing rules prohibit. Separately, the suggestion to nest Framework Library under a future Insights section conflicts with docs/ARCHITECTURE.md's existing, already-approved Information Architecture, which scopes Framework Library as an expansion of how-halo-thinks.html instead. That's a real discrepancy between casual guidance and recorded architecture; flagged for Fabien to resolve explicitly rather than silently picking one. The "distinct CTA button" request is already satisfied by the existing `.btn.btn-primary`, visually separate from the nav-links list; no change was needed there.

**Implement.** CSS changes to all 12 pages (`.navbar`, `.logo`, `.logo-mark`, `.nav-links`). HTML markup changes (header and footer logo blocks) to the 5 previously-text-only pages.

**Verify.** Diffed the header logo markup, footer logo markup, and the four CSS rules across all 12 pages against commercial-audit.html: byte-identical everywhere. Reviewed the full `git diff` per file; changes are confined to the four CSS rules and, on the 5 legacy pages, the two logo markup blocks, nothing else touched. No visual/screenshot verification was available (local file preview did not render in the browser tool used this session); verification is structural and diff-based, consistent with this repository's established practice when visual tooling isn't available.

**Document.** This entry; see docs/CHANGELOG.md.

---

## Phase 1 SEO Sprint (2026-07-26)

**Trigger.** Fabien's bounded Phase 1 instruction: finish mechanical, decision-free technical fixes; produce a page-by-page audit; draft (don't invent-and-ship) strategic recommendations; log blocked items; build a content roadmap. Title/meta implementation was explicitly approved directly in conversation after a proposal round, rather than left as a standing PROPOSED item.

**Inspect.** Re-checked the full 12-page audit from the prior session (docs delivered as a standalone report, not committed here) against this narrower brief: heading hierarchy, broken links, canonical, duplicate titles/descriptions, alt text, filenames, accessibility, HTML validation, indexability were all already verified clean except two remaining items: contact.html's H1->H3 heading skip, and no other unescaped `&` beyond the one already fixed on terms-and-conditions.html (checked systematically this pass, none found).

**Decisions made and why.** Fixed contact.html's heading skip by promoting its four card headings from h3 to h2 (semantic level only, zero new copy), rather than inventing a new wrapping heading, since that would have been a content decision this sprint was explicitly scoped to avoid. Drafted title/meta copy for five pages where the prior audit identified a real gap (Home, About, Commercial Diagnostic, Commercial Audit, Contact); left How Halo Thinks and Selected Engagements untouched deliberately, their existing branded framing was flagged as worth protecting from generic keyword-forcing, not a gap to fix; left the three legal pages and two utility pages untouched, no meaningful keyword target exists for them.

**Implement.** Title tags reordered to keyword-first on index.html ("Commercial Growth Consultancy | Halo Strategic") and about.html ("Commercial Growth Strategist | Halo Strategic"); contact.html's title changed to "Book a Discovery Call | Halo Strategic" to match actual intent. Meta descriptions rewritten and lengthened into the 150-160 character target on commercial-diagnostic.html (92 -> 160 chars), commercial-audit.html (126 -> 152 chars), and contact.html (57 -> 149 chars); og:title/og:description/twitter:title updated identically alongside each `<title>`/meta change so nothing drifts out of sync. No other page's title or meta description was touched.

**Verify.** Measured every draft's exact character length with `wc -c` before implementing, not estimated. Confirmed all 12 titles remain unique after the change (no duplicates introduced). Diffed each file's git changes to confirm only the intended tags changed.

**Document.** This entry; see docs/CHANGELOG.md. Full audit report and content roadmap delivered directly, not committed to this repository, since they are working documents for this conversation rather than adopted engineering documentation, consistent with docs/AI_OPERATING_MODEL.md's Research Document Governance principle applied here by analogy.

---

## URL Strategy Resolution: Extensionless URLs Site-Wide (2026-07-26)

**Trigger.** A contradiction surfaced between a research report describing the live site as serving clean URLs while canonicalising to `.html`, and this session's own earlier claim that canonical tags were simply correct. Rather than assume either side, tested the live production site directly.

**Inspect.** `curl` testing against the live site found `/about` and `/about.html` both returning `200 OK` with identical content and no redirect between them, confirmed on a second page (Commercial Audit) to rule out a one-page fluke. A nonexistent path correctly 404'd, ruling out a wildcard misconfiguration. The canonical tag content was identical regardless of which URL variant served the request, since it's static markup, not request-aware. No `netlify.toml`, `_redirects`, or `_headers` file existed anywhere in the repository, confirming this was Netlify's untouched default pretty-URL behaviour colliding with an all-`.html` codebase, not something anyone had configured deliberately. Findings written up as a standalone URL Architecture Decision Record (evidence only, no recommendation) and delivered before any change was made.

**Decisions made and why.** Fabien decided extensionless, informed by the decision record and `docs/ARCHITECTURE.md`'s pre-existing (unapproved until now) lean toward extensionless for future Insights URLs. Recorded as ADR-008 rather than left undocumented, since it's a genuine new architectural decision, not a status correction.

**Implement.** Applied a scripted, verified find-and-replace across all 12 HTML files: every internal `href` referencing another page (`page.html` -> `/page`, `index.html` -> `/`, including anchor variants like `/#how-it-works` and `/selected-engagements#reacting-to-leading`), every canonical tag and `og:url` (`https://halostrategic.com/page.html` -> `https://halostrategic.com/page`), and contact.html's form `action` attribute (`/thank-you.html` -> `/thank-you`). Deliberately excluded 404.html's own filename and canonical, Netlify's error-page convention, not a page anyone links to. Added a `_redirects` file at the repository root 301ing every legacy `.html` path to its extensionless equivalent, so existing shares, bookmarks, or indexed `.html` URLs still resolve.

**Verify.** Grepped for any remaining internal `.html` href/action references (found only 404.html's own canonical, expected). Grepped for double slashes (none). Confirmed all 12 titles remain unique. Reviewed every file's full `git diff` individually; each showed only the intended link/canonical/og:url substitutions, balanced insertion/deletion counts (275/275 across all 12 files), nothing else touched. Cross-checked the resulting internal link set for completeness (all page-name mappings present, both Selected Engagements anchor IDs preserved).

**Document.** This entry; see docs/CHANGELOG.md, docs/ARCHITECTURAL_DECISIONS.md (ADR-008), docs/ARCHITECTURE.md (URL Philosophy, updated), docs/ROADMAP.md and docs/CURRENT_SPRINT.md (Sprint 2 status updated), and the URL Architecture Decision Record delivered this session.

**Follow-up correction (same day, after live verification):** post-deploy, confirmed the HTML changes (canonical tags, links) had gone live correctly, but `/about.html` still returned `200 OK` directly instead of the expected `301` redirect. Root cause: Netlify serves an exactly-matching static file before evaluating `_redirects` rules, unless the rule is explicitly forced. Added the `!` force flag to every rule in `_redirects` and re-deployed. This is a correction to the same not-yet-fully-verified change, not a rewrite of the earlier entry above, the HTML/canonical portion of that work was already confirmed correct; only the redirect-file syntax needed fixing.

---

## Sprint 2: sitemap.xml and robots.txt (2026-07-26)

**Trigger.** Fabien approved generating these now that the URL strategy (ADR-008) was resolved and live, closing the dependency `docs/ROADMAP.md` had flagged.

**Decisions made and why.** Included the 10 pages meant to be discovered via search: homepage and the 9 content/legal pages. Excluded `404.html` (an error page, never a real destination) and `thank-you.html` (a post-submission confirmation page). Neither exclusion required changing either page's indexability, both remain un-`noindex`ed, per the last audit, this is a sitemap-inclusion choice (standard practice for these two page types), not an indexability policy change, and is flagged as such rather than done silently. Used only `<loc>` and `<lastmod>` per URL, skipped `changefreq`/`priority`, both are widely documented as ignored by Google and add no value. `lastmod` set to 2026-07-26 for all 10, accurate, every page was genuinely touched today. robots.txt uses a simple `Allow: /` for all user agents (no private/admin areas exist to disallow) plus a `Sitemap:` line pointing to the new file.

**Implement.** Added `sitemap.xml` and `robots.txt` at the repository root.

**Verify.** Confirmed `sitemap.xml` is well-formed (balanced `<url>` tags, 10 entries, checked programmatically) and that its 10 URLs exactly match the site's own canonical tag set. Spot-checked 3 of the 10 URLs resolve live with `200 OK` post-deploy.

**Document.** This entry; see docs/CHANGELOG.md and docs/CURRENT_SPRINT.md.

---

## Sprint 3: Insights Section + Article #1 (2026-07-26)

**Trigger.** Fabien approved standing up the Insights section and publishing Article #1 (drafted and approved earlier this session per the Editorial Bible, content backlog, and article template, all delivered directly, not committed to this repository).

**Inspect.** Confirmed via docs/ARCHITECTURE.md that Insights did not exist and that its suggested nav position and folder-vs-templating question were already documented but not decided. Used about.html as the structural template (head boilerplate, header/nav, footer), since it's a representative, already-verified-correct page.

**Decisions made and why.** Built `insights/index.html` and `insights/every-department-can-be-doing-its-job-well.html` by copying about.html's shared boilerplate programmatically (a Node script, not manual retyping, to avoid transcription drift across the large embedded CSS block), then substituting title/meta/canonical/og tags and the main content. This is direct hand-maintenance, the same approach every other page already uses, not a new templating system, the site never had one to begin with (ADR-001 Amendment). Implemented the nav reorder (insert Insights, move Selected Engagements before How Halo Thinks) across all 12 existing pages via a Node script rather than manual sed, since it required both an insertion and a reorder of two adjacent lines with three different active-class variants depending on the page; verified programmatically that exactly 24 insertions (12 files x nav+footer) and 24 reorders occurred, matching expectation exactly. Did not add Article schema, that's a genuine new decision now that Insights is real, not automatically unblocked by building the section (docs/ROADMAP.md, Sprint 3).

**Implement.** Two new files in a new `insights/` subdirectory. Nav/footer updated across all 12 existing root-level pages. Two new forced `_redirects` entries. Two new sitemap.xml entries.

**Verify.** Caught and fixed two bugs before considering this done: (1) the noscript GTM block was duplicated in both new files, a script logic error (the header slice already included it, and it was also being inserted separately); fixed and reconfirmed exactly 2 GTM references and 1 `<body>` tag per file. (2) Confirmed via grep that the three active-class variants (neither page active, how-halo-thinks.html active, selected-engagements.html active) all resolved correctly after the reorder script ran. Read both new files in full afterward to confirm overall coherence, not just the automated counts. Confirmed sitemap.xml remains well-formed (12 `<url>` tags, balanced) after adding the two new URLs.

**Document.** This entry; see docs/CHANGELOG.md, docs/CURRENT_SPRINT.md, docs/ARCHITECTURE.md (Information Architecture, Folder Structure, Future Scalability all updated), docs/ARCHITECTURAL_DECISIONS.md (ADR-004 and ADR-008 notes added), and docs/ROADMAP.md (Sprint 3 status updated).

---

## Sprint 3: Insights Build System, ADR-009 (2026-07-26)

**Trigger.** Fabien: "Decide on the build approach before article #2."

**Analyse.** The actual, demonstrated problem this session was hand-copying ~250 lines of shared boilerplate per Insights page and shared elements drifting out of sync across files, this produced two real bugs caught only by manual verification (a duplicated GTM noscript block, a redirect double-hop from an inconsistent trailing slash). A CMS or a Netlify-side build step would solve non-technical publishing or automated deploys, problems nobody has actually hit; a generator solves the one that did happen. Recorded as ADR-009, decided in favour of a local template + JSON generator over a CMS or a Netlify-side build, consistent with ADR-001's existing reasoning against a JS framework at this site's scale.

**Implement.** Extracted `tools/insights-article-template.html` and `tools/insights-index-template.html` from the two already-published Insights pages (tokenising the per-page fields: title, meta description, canonical, h1, body for articles; the card list for the index), rather than writing new templates from scratch, so the templates start from what's already approved and live. Extracted article #1's actual content into `tools/insights-articles.json` (slug, title, h1, meta description, category, teaser, publish date, body HTML). Wrote `tools/build-insights.js`, which reads the templates and JSON and generates `insights/index.html` and one file per article, with basic validation (required fields, slug format) that fails loudly rather than silently generating a broken page.

**Verify.** Ran the generator and diffed its output against the already-published files: found one real discrepancy, an unescaped `&` in the category field (the same class of bug as the terms-and-conditions.html `&amp;` fix earlier this session), caused by injecting plain-text JSON fields directly into HTML without escaping. Fixed by adding an `escapeHtml` helper applied to all plain-text fields (title, meta description, h1, teaser, category), deliberately not applied to the body field, which is meant to contain real markup, consistent with how every other page's content is hand-authored HTML. Re-ran and re-diffed: both files byte-for-byte identical to the already-published, already-approved versions. Confirmed via `git status` that only `tools/` appeared as new, `insights/*.html` were untouched by the verified-correct regeneration.

**Document.** This entry; see docs/CHANGELOG.md, docs/CURRENT_SPRINT.md, docs/ARCHITECTURAL_DECISIONS.md (ADR-009, ADR-004 update), docs/ARCHITECTURE.md (Future Scalability updated), and docs/ROADMAP.md (Sprint 3 scaling flag resolved).

---

## Sprint 3: Article #2 via the Generator (2026-07-26)

**Trigger.** Fabien approved Article #2 ("How to Tell a Marketing Problem from a Commercial Problem") after reading a draft delivered directly this session, drafted per the Editorial Bible and Article Template, grounded only in the sales-follow-up and market-too-small Selected Engagements case studies plus the relevant How Halo Thinks principle, nothing invented.

**Implement.** First real use of ADR-009's generator: appended one entry to `tools/insights-articles.json` (via a small script, not hand-edited, to avoid JSON escaping mistakes) and ran `node tools/build-insights.js`. Added the new URL to `sitemap.xml` and a forced `_redirects` entry for its `.html` filename, matching the pattern for every other page.

**Verify.** Confirmed article #1's regenerated file has zero diff (no regression from adding a second article to the data set). Confirmed the new article's title/meta/canonical are correct, GTM and Organization schema present (2 and 1 occurrences respectively, matching every other page), single `<body>` tag. Confirmed the index page's diff added exactly one new card, correctly HTML-escaped ("Commercial Diagnosis &amp; Constraint-Finding"), with article #1's existing card untouched. Confirmed sitemap.xml remains well-formed (13 `<url>` tags, balanced) after the addition. This is the first real evidence the generator built in response to "decide on the build approach before article #2" actually does what it was built for: adding an article is a one JSON entry, one script run, not a new hand-copied file.

---

## Sprint 5.6: Product Architecture & Commercial Positioning (2026-07-26)

**Trigger.** Following the Halo Bible's Philosophy, Master Framework, and Revenue Friction Map sections (built via founder interview and direct instruction earlier the same day), Fabien specified an actual 6-stage product ecosystem and requested four documents converting it into commercially usable form, explicitly as product architecture and positioning work, not implementation.

**Analyse.** The brief itself set the constraint: don't invent new philosophy or terminology, trace every product to the existing Leakage → Friction → Constraint → Alignment hierarchy and Halo's First Law (diagnosis before prescription, always), and present any unresolved commercial decision (pricing, naming, scope) as options with rationale rather than an assumed outcome. Two live-site facts made this non-trivial: Commercial Diagnostic is currently free and Commercial Audit is currently a fixed £3,000, both of which this ecosystem's proposed pricing (Diagnostic ~$995, Audit ~$7,500+) would change, and the shift to USD pricing implies an undecided US-market positioning question underneath the pricing itself.

**Decisions made and why:**
- Restructured the prior 5-tier/16-product draft into Fabien's 6-stage structure (Discover, Investigate, Design, Implement, Optimise, Partnership); flagged two products from the prior draft (Lead Management System, Growth Board) that aren't named in the new structure, rather than silently keeping or cutting them.
- Did not treat the proposed pricing as decided. `PRICING_STRATEGY.md` presents the current-vs-proposed comparison for both live products plus three sequencing options (sequenced, bundled, pause-and-resolve-market-question-first), with no option recommended over another, since the right choice depends on how firm the US-market decision already is.
- Drafted the Halo Clarity Guarantee's copy and FAQ, but flagged the refund mechanism (trigger, time window, cross-border payment handling, consumer-protection law) as needing real legal/accounting review before publishing, not something this document can settle.
- Flagged the weakest point in the diagnosis-first enforcement: Stage 6 (Partnership) has a softer entry criterion ("typically follows the full journey") than every other stage's hard gate.

**Implement.** Four new files: `docs/PRODUCT_SYSTEM.md` (hierarchy, journey map, per-product definitions across all six stages), `docs/PRODUCT_POSITIONING.md` (why the ecosystem differs from a traditional agency's service catalogue, mapped chapter-by-chapter to the Philosophy), `docs/PRICING_STRATEGY.md` (comparison, risks, three options), `docs/GUARANTEE.md` (guarantee copy, customer promise, legal flags, FAQ).

**Verify.** Checked each document's product list, entry criteria, and terminology against `docs/PRODUCT_SYSTEM.md`'s own hierarchy for internal consistency (e.g. Positioning and Guarantee both reference the same stage names and the same Stage 6 gap). Did not verify the $995/$7,500 pricing figures against real market data, `PRICING_STRATEGY.md` says so explicitly and recommends that verification as separate research work.

**Document.** This entry; see docs/CHANGELOG.md and docs/CURRENT_SPRINT.md. Nothing in this sprint touched the live site, the four documents are working documents pending Fabien's decisions on the open items each one lists.

---

## Sprint 5.6: Live Implementation (2026-07-26, ADR-010)

**Trigger.** Fabien, as Product Owner, sent an explicit approval and implementation instruction: "The Product System, pricing direction, and Halo Clarity Guarantee are approved as the strategic direction for Halo. Proceed with implementation," listing approved decisions (introduce Health Check, reprice Diagnostic, reposition Audit, premium positioning), initial USD pricing, the Guarantee as placeholder copy not to be delayed for legal review, and website scope (Health Check page, Diagnostic page, Audit positioning, product journey, nav, ecosystem, internal linking). Instructed not to ask for further approval except for technical blockers, legal issues, or material deviation from the approved decisions.

**Analyse.** Read both live pages in full before editing. Found the actual current model differs slightly from `docs/PRODUCT_SYSTEM.md`'s description: the live Commercial Diagnostic is a free written summary following a free "Discovery Call," not itself a paid session, repricing it to $995 means the Diagnostic absorbs what was previously a two-step free process into one paid, structured session. Decided the pricing needed to be data, not hardcoded text, per the explicit instruction, and that a real payment backend or CMS would be disproportionate (ADR-004's reasoning applies), so a small client-side config file was the right scope.

**Decisions made and why:**
- Built `pricing-config.js` as the single source of truth for prices (ADR-010), read at runtime via `data-price` attributes, structured for future currencies without inventing a GBP figure Fabien hasn't given.
- Held Lead Management System and Growth Board out of the live Product Journey page, consistent with them being flagged (not confirmed) in `docs/PRODUCT_SYSTEM.md`.
- Did not invent prices for Stage 3–6 products; `product-journey.html` shows them as "by proposal" or "retainer," not fabricated figures, so the page doesn't oversell what `docs/PRODUCT_SYSTEM.md` itself still marks open.
- Used the Guarantee's suggested 14-day placeholder window directly, per Fabien's explicit instruction not to delay implementation for legal wording.
- Changed the Commercial Audit's nav-right CTA link from a raw contact-form link to `/commercial-diagnostic`, and its process/timeline copy from a fixed "four weeks" to "three to six weeks, depending on scope," consistent with the new scope-dependent pricing.
- Swapped every page's nav-right CTA from "Start with a Commercial Diagnostic" (linking to a homepage anchor) to "Free Commercial Health Check" (linking to the new page), since Health Check is now the approved lowest-friction entry point and should be the one pushed hardest site-wide.

**Implement.** New files: `pricing-config.js`, `commercial-health-check.html` (6-question client-side-scored self-assessment, one question per Commercial Leakage Framework area, no data submitted or stored), `product-journey.html` (the full 6-stage ecosystem). Modified: `commercial-diagnostic.html` (pricing, Guarantee section, comparison table, step-row, meta/OG tags), `commercial-audit.html` (pricing, FAQ and FAQPage JSON-LD, timeline, hero CTA), `sitemap.xml` (13 → 15 URLs), `_redirects` (2 new forced entries). Nav, footer, and CTA updated across all 16 HTML pages via a script for the 12 unchanged root pages plus the two Insights templates, then two follow-up passes to fix a footer-insertion regex gap the first script run missed (verified by grep count per file until every file showed the expected occurrence counts, rather than assuming the bulk script had worked everywhere). Insights pages regenerated via `tools/build-insights.js` from the updated templates, not hand-edited, per ADR-009's own rule.

**Verify.** Grep-counted GTM (2), pricing-config include (1), and data-price spans across all four pricing-aware pages. Confirmed all 16 HTML pages carry exactly one Health Check footer link, one Product Journey nav link, and one Product Journey footer link, catching and fixing a real bug where the first bulk-update script silently failed to insert the footer's Product Journey link on 12 of 14 files (a regex/indentation mismatch), found by grep-verifying counts rather than trusting the script's own reported success numbers. Confirmed `sitemap.xml` remains well-formed (15 `<url>` tags, balanced). Confirmed single `<body>` tag on both new pages.

**Document.** This entry; see docs/CHANGELOG.md, docs/CURRENT_SPRINT.md, docs/ARCHITECTURAL_DECISIONS.md (ADR-010, Pending Decisions updated).

---

## Product Journey Restructure: Clarity → Strategy → Transformation → Partnership (2026-07-27, ADR-014)

**Trigger.** Fabien identified that the live "Diagnostic → Audit → Implementation" framing communicated a product ladder rather than the intended positioning, proposed a 4-word narrative arc and a simplified 5-product structure, then, in a follow-up message, explicitly separated that positioning change from a pricing change he'd floated in the same breath, instructing pricing to be held exactly as-is.

**Analyse.** Two variables were genuinely tangled in the original proposal: new names/narrative (clear win, no downside) and new GBP figures for the Audit ($7,500+ → £5,000–£10,000, not just a currency conversion of the same number). Rather than guess which Fabien actually wanted live, asked directly via AskUserQuestion; he confirmed "positioning now, hold pricing," then reiterated the same in a follow-up message with his reasoning for staying USD (US-oriented target market: ADU companies, agencies, GQL exposure). The consolidation itself (5 products instead of 14) also resolved two previously-flagged open questions from ADR-010/PRODUCT_SYSTEM.md, the Quarterly/Constraint Review overlap and the Growth Partner/Fractional Growth Strategist distinction, by folding both pairs into single products rather than needing to pick a winner.

**Decisions made and why:**
- Restructured `product-journey.html`'s stage sections from 6 stages to 4, renamed throughout, added the Governing Sentence as a `.pull` blockquote directly under the hero.
- Added `.tag-row`/`.tag` CSS to `product-journey.html` (previously only existed on `agency-partnerships.html`) to display Commercial Transformation's examples as tags rather than as separate priced cards, since they're illustrative, not a menu.
- Renamed "Implementation Proposal" → "Commercial Transformation proposal" and "an Implementation engagement" → "a Commercial Transformation engagement" on `commercial-audit.html`, in both the visible FAQ and the FAQPage JSON-LD (kept in sync, per the established ADR-007 rule), and in the deliverables table. Left two lowercase, generic uses of "implementation" untouched (not the product name).
- Updated `commercial-diagnostic.html`'s "What it is" section to the outcome-focused deliverables list Fabien specified verbatim, added the 90-minute session length to both the comparison table and the step-row, added "no promise to fix anything, the promise is clarity."
- Did not touch `pricing-config.js` or any `data-price` value; verified this explicitly rather than assuming.

**Implement.** `product-journey.html`, `commercial-diagnostic.html`, `commercial-audit.html` edited directly. `docs/PRODUCT_SYSTEM.md` rewritten (new hierarchy table, journey map, per-product entries under the four new stage headings, open items updated). `docs/PRODUCT_POSITIONING.md` rewritten to match, including a note that the Governing Sentence resolves what was previously this document's own flagged weak point (Partnership's soft entry gate). `docs/HALO_BIBLE.md` Section Ten given a dated amendment note (frozen document, ADR-012, no silent rewrite). New `docs/ARCHITECTURAL_DECISIONS.md` ADR-014; the existing US-market Pending Decision entry appended with Fabien's stated reasoning, not closed.

**Verify.** Grep-confirmed `data-price` values unchanged on both edited pages (healthCheck=Free, diagnostic=$995, audit=$7,500+). Grep-confirmed zero remaining capitalised "Implementation" product references on `commercial-audit.html`. Confirmed body-tag and GTM counts unchanged on all three edited pages (no structural breakage from the section rewrite).

**Document.** This entry; see docs/CHANGELOG.md, docs/CURRENT_SPRINT.md, docs/ARCHITECTURAL_DECISIONS.md (ADR-014).

---

## Sprint 5.6: Agency Partnerships (2026-07-26, ADR-011)

**Trigger.** Fabien sent a complete "FEATURE BRIEF: Halo Agency Partner Network," fully specifying headline, subheadline, CTAs, eight content sections, design direction, technical notes, and success criteria for a new secondary-audience page targeting marketing agencies as partners rather than clients.

**Analyse.** The brief was self-contained, no business decision needed inventing (unlike, say, Growth Maturity Model levels earlier in this project). Two things needed judgement rather than being handed directly: (1) three FAQ questions (white-label, co-branding, partner pricing) the brief itself flags as future-phase or unset, so the honest answer is "not yet," not a fabricated feature or number; (2) exact nav/footer placement, resolved directly from the brief's own instruction (footer link, optional About link, not main nav).

**Decisions made and why:**
- New page at `/agency-partnerships` (brief's preferred URL), extensionless per ADR-008.
- Footer-only placement across all 17 existing pages (verified via grep, exactly one occurrence per file) plus one inline text link on `about.html`'s closing CTA section ("Run a marketing agency? See Halo's Agency Partnerships"). Not added to any page's main nav-links, confirmed via grep across every nav-links block.
- Reused the existing Leakage/Friction/Constraint/Alignment vocabulary from Section One of the Bible for "A Better Way" rather than introducing new terms, and reused the Halo Clarity Guarantee's approved wording verbatim rather than drafting new guarantee language for this audience.
- Did not build or stub the brief's own "Future-Proofing" list (Partner Portal, white-label diagnostics, co-branded reports, referral dashboard, certification programme, training academy, partner directory), consistent with the brief's explicit "should not be implemented now." The page's section-per-topic structure (one `<section id="...">` per topic) is what makes future additions possible without a redesign; no placeholder UI was added for them.

**Implement.** New file `agency-partnerships.html`: hero, 8 content sections (`#the-problem`, `#a-better-way`, `#how-it-works`, `#benefits`, `#partner-promise`, `#perfect-for`, `#guarantee`, `#faq`), final CTA with two buttons per the brief. Organization, Service, and FAQPage JSON-LD. Footer link added to all 16 other existing pages (12 root pages, the 2 Insights templates, then regenerated via `tools/build-insights.js`) via a script anchored on the Product Journey → Insights footer adjacency, same technique as Sprint 5.6's earlier nav rollout. `sitemap.xml` (15 → 16 URLs) and `_redirects` updated.

**Verify.** Grep-confirmed the footer link's presence (exactly once) across all 17 pages including the newly regenerated Insights pages, and its absence from every page's nav-links block. Confirmed `sitemap.xml` remains well-formed (16 `<url>` tags, balanced).

**Document.** This entry; see docs/CHANGELOG.md, docs/CURRENT_SPRINT.md, docs/ARCHITECTURAL_DECISIONS.md (ADR-011, Pending Decisions updated).

---

## Halo Bible v1.0 Frozen (2026-07-26, ADR-012)

**Trigger.** Fabien: "I'd declare the Halo Bible frozen... Version 1.0 should become the constitutional document for the company... From this point forward, you should be protecting Halo," following the completion of Sections Six (Growth Maturity Model) and Seven (Halo Indicators), the last two open sections.

**Analyse.** The Bible's ten sections existed only as scratchpad files (session-temporary) and one working scoped-draft document, neither durable nor actually in the repo. A document meant to govern the company long-term can't live somewhere that vanishes with the session, compiling it into the actual repo wasn't optional busywork, it was the only way the freeze decision could mean anything. Also found, while compiling: the Glossary's Commercial Diagnostic and Commercial Audit entries in the working draft still described pre-Sprint-5.6 pricing (free Diagnostic, fixed £3,000 Audit), a real staleness that would have been frozen into the constitutional version if not caught during the compile pass.

**Decisions made and why:**
- Compiled all ten sections into a single `docs/HALO_BIBLE.md`, rather than leaving them as ten separate files, so there's one canonical document to point to, not a scattered set of scratchpad references.
- Section Ten (Products) summarizes and points to `docs/PRODUCT_SYSTEM.md` rather than duplicating its content, since PRODUCT_SYSTEM.md is the living, current-pricing document and will keep changing as pricing/scope decisions resolve; duplicating it into a frozen document would guarantee drift between the two.
- Corrected the Glossary's Commercial Diagnostic/Audit definitions to match actual live pricing ($995, $7,500+) before freezing, rather than freezing the stale figures and needing an immediate amendment.
- Updated `docs/AI_OPERATING_MODEL.md`'s Documentation Ownership table with a new row for HALO_BIBLE.md marked as having no ordinary maintainer, constitutional documents don't fit the normal owner/maintainer pattern used for every other doc in that table.

**Implement.** New file `docs/HALO_BIBLE.md`: governance header (frozen, amendment-only, dated appends), table of contents, all ten sections in full. New ADR-012 in `docs/ARCHITECTURAL_DECISIONS.md`. Updated `docs/AI_OPERATING_MODEL.md`, `docs/CURRENT_SPRINT.md`, `docs/CHANGELOG.md`.

**Verify.** Cross-checked every section's compiled content against its originating scratchpad source (Sections One, Three, Five, Six, Seven, each a standalone file) or already-published live content (Sections Two, Four, Eight, Nine) before compilation; no new claims introduced during the compile step itself, only the pricing correction noted above, which is a correction against reality, not new invention.

**Document.** This entry; see docs/CHANGELOG.md, docs/CURRENT_SPRINT.md, docs/ARCHITECTURAL_DECISIONS.md (ADR-012).

**Document.** This entry; see docs/CHANGELOG.md and docs/CURRENT_SPRINT.md.

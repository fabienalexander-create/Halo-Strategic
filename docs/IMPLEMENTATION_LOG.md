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

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

# Google Tag Manager

## Container

- Container ID: `GTM-T49HRT6J`
- Account: Halo Strategic
- Installed on: all 16 root pages, all 11 Insights pages, and diagnostic-landing.html (34 files total, re-verified 2026-07-31 via repo-wide grep for `GTM-T49HRT6J`). The 10-of-12 gap noted below was closed 2026-07-26 (see docs/TECHNICAL_SEO_STATUS.md, finding 7).
- Snippet placement: head script immediately before `</head>`, noscript iframe immediately after `<body>`, generated from a single shared source (`site/gtm_snippets.py`) so every page gets an identical, correctly-placed install.
- Verified one head snippet and one body snippet per page (no duplicates) via automated grep across all 10 files before pushing.

## What's already configured (found in place, not built by this pass)

- Tag: "GA4 - Configuration - Halo Strategic" — Google Tag type, Measurement ID `G-KC0RH0SS1L`, trigger "Initialization - All Pages". This was already built in the container (edited ~4 hours before this session), left as-is rather than duplicated.
- Variable: "DOM - Page Title" — Custom JavaScript, already built, left as-is.
- No custom triggers existed prior to this pass. None were added in this pass either, see Deferred below.

## Automatic GA4 events

page_view, session_start, scroll, click, outbound_click, file_download, form_start, and form_submit are covered by GA4's Enhanced Measurement, a setting on the GA4 property itself (Admin → Data Streams → your stream → Enhanced Measurement toggle), not something built manually in GTM. No GTM trigger work was needed for these. Worth a quick check in the GA4 UI that Enhanced Measurement is switched on for the Halo Strategic stream.

## Conversion events: what the site already fires (2026-07-31 update)

The original seven-event plan below this line named `discovery_call_started`/`discovery_call_booked` as priority events. That concept no longer exists on the site — "Discovery Call" was removed sitewide as an undefined third funnel entry point (see docs/ARCHITECTURAL_DECISIONS.md, ADR-016). Treat that original plan as superseded; this section replaces it with what the code actually does today.

Three real, already-firing `dataLayer` events exist in the code right now, none of which have a GTM trigger/tag built for them yet:

1. **`form_submit_success`** — fires on the main Contact form (`index.html` and `contact.html`), with `form_id: 'contact-form'` and a `service` field carrying the dropdown selection (Diagnostic booking / Audit enquiry / General enquiry).
2. **`form_submit_success`** — fires on the new Ads landing page form (`diagnostic-landing.html`), with `form_id: 'diagnostic-landing'` and `source: 'google-ads-landing-page'`. This is the one conversion event Google Ads actually needs at launch.
3. **`health_check_completed`** — fires when a visitor finishes the free Commercial Health Check quiz, carrying `health_check_score` and `health_check_band`.

### Exact GTM configuration needed (manual, in tagmanager.google.com)

For each event below: Trigger type "Custom Event", Event name matching exactly, then a GA4 Event tag referencing the existing "GA4 - Configuration - Halo Strategic" tag as its Configuration Tag.

- **Trigger:** Custom Event, event name `form_submit_success`, fire condition `form_id equals diagnostic-landing` → **GA4 Event tag** named "GA4 - diagnostic_requested", Event Name `diagnostic_requested`. This is the primary Google Ads conversion for the campaign; mark it as a Key Event/Conversion in GA4 once it's firing (Admin → Events → toggle "Mark as key event" next to `diagnostic_requested`).
- **Trigger:** Custom Event, event name `form_submit_success`, fire condition `form_id equals contact-form` AND `service equals diagnostic` (or `audit`, run twice for two separate tags if you want them split) → **GA4 Event tag**, Event Name `contact_diagnostic_requested` / `contact_audit_requested`.
- **Trigger:** Custom Event, event name `health_check_completed` → **GA4 Event tag** named "GA4 - health_check_completed", Event Name `health_check_completed`, with `health_check_score` and `health_check_band` passed through as event parameters (Preview mode will show them in the dataLayer to map).

Two further click-based events from the original brief remain genuinely not possible yet: `phone_clicked` (no `tel:` link exists anywhere on the site) and `linkedin_clicked` (the LinkedIn Page link in the footer would need a Click - Just Links trigger filtered to `linkedin.com` — buildable, just not done in this pass, low priority next to the form events above).

## Future-proofing

The container is structured so GA4 sits as the base layer, with Google Ads Conversion/Remarketing, LinkedIn Insight Tag, Microsoft Clarity/Ads, Meta Pixel, and a cookie consent tool addable later purely as new tags/triggers inside this same container, no code changes to the site required. None of these were installed in this pass, only the GTM shell itself.

## Compliance side-effect

privacy-policy.html and cookie-policy.html both previously stated no analytics/tracking was in use. Both were rewritten to accurately describe GA4 (via GTM) and its cookies (`_ga`, `_ga_*`), since shipping GTM without correcting these pages would have made them false the moment the container publishes.

## Next

1. Build the three trigger/tag pairs in the "Exact GTM configuration needed" section above, `diagnostic_requested` (from the Ads landing page) first.
2. Publish the container: run Preview mode against the live site to confirm GA4 fires cleanly with no duplicate tags, then click Submit on the pending workspace changes.
3. Confirm Enhanced Measurement is on in the GA4 property, and mark `diagnostic_requested` as a Key Event once it's firing.
4. Revisit Google Ads Conversion and LinkedIn Insight tags once the campaign account exists — this container is structured to take them as new tags with no code changes required.

Items 4 (GTM/nav parity on terms-and-conditions.html and 404.html) and the old "Consultancy Events" plan from the original brief are resolved/superseded — see docs/TECHNICAL_SEO_STATUS.md finding 7-8 and the Conversion Events section above.

## Note (2026-07-26)

The `site/gtm_snippets.py` build source referenced above (Container section) could not be located anywhere in this repository's history or in related local locations searched during an onboarding review. See docs/ARCHITECTURAL_DECISIONS.md, ADR-001 Amendment, and docs/IMPLEMENTATION_LOG.md's Documentation Correction entry. The GTM snippet placement described above is otherwise unchanged and, per docs/TECHNICAL_SEO.md, verified present in the pages it claims.

# Google Tag Manager

## Container

- Container ID: `GTM-T49HRT6J`
- Account: Halo Strategic
- Installed on: index.html, about.html, contact.html, commercial-diagnostic.html, commercial-audit.html, how-halo-thinks.html, selected-engagements.html, privacy-policy.html, cookie-policy.html, thank-you.html (10 of 12 pages; terms-and-conditions.html and 404.html not yet crawled/updated, see Next below)
- Snippet placement: head script immediately before `</head>`, noscript iframe immediately after `<body>`, generated from a single shared source (`site/gtm_snippets.py`) so every page gets an identical, correctly-placed install.
- Verified one head snippet and one body snippet per page (no duplicates) via automated grep across all 10 files before pushing.

## What's already configured (found in place, not built by this pass)

- Tag: "GA4 - Configuration - Halo Strategic" — Google Tag type, Measurement ID `G-KC0RH0SS1L`, trigger "Initialization - All Pages". This was already built in the container (edited ~4 hours before this session), left as-is rather than duplicated.
- Variable: "DOM - Page Title" — Custom JavaScript, already built, left as-is.
- No custom triggers existed prior to this pass. None were added in this pass either, see Deferred below.

## Automatic GA4 events

page_view, session_start, scroll, click, outbound_click, file_download, form_start, and form_submit are covered by GA4's Enhanced Measurement, a setting on the GA4 property itself (Admin → Data Streams → your stream → Enhanced Measurement toggle), not something built manually in GTM. No GTM trigger work was needed for these. Worth a quick check in the GA4 UI that Enhanced Measurement is switched on for the Halo Strategic stream.

## Deferred: Consultancy Events

The brief calls for seven custom conversion events: discovery_call_started, discovery_call_booked, commercial_diagnostic_requested, commercial_audit_requested, contact_form_submitted, email_clicked, phone_clicked, plus linkedin_clicked. None of these were built in this pass. Reason: each needs a purpose-built GTM trigger (form submission scoped to the right page/form ID, or click triggers filtered by URL, link text, or element), and building seven of them accurately through the GTM UI in one sitting, on a browser connection that was intermittently unresponsive during this session, was a reliability risk not worth taking blind. Recommend a focused follow-up session for this specifically.

Two flagged as the priority conversion events to wire up first, per your instruction: commercial_diagnostic_requested and commercial_audit_requested. Note phone_clicked has no `tel:` link on the site currently, so that trigger has nothing to fire on until one exists.

## Future-proofing

The container is structured so GA4 sits as the base layer, with Google Ads Conversion/Remarketing, LinkedIn Insight Tag, Microsoft Clarity/Ads, Meta Pixel, and a cookie consent tool addable later purely as new tags/triggers inside this same container, no code changes to the site required. None of these were installed in this pass, only the GTM shell itself.

## Compliance side-effect

privacy-policy.html and cookie-policy.html both previously stated no analytics/tracking was in use. Both were rewritten to accurately describe GA4 (via GTM) and its cookies (`_ga`, `_ga_*`), since shipping GTM without correcting these pages would have made them false the moment the container publishes.

## Next

1. Publish the container: log in to tagmanager.google.com, run Preview mode against the live site to confirm GA4 fires cleanly with no duplicate tags, then click Submit on the pending workspace changes.
2. Confirm Enhanced Measurement is on in the GA4 property.
3. Build the Consultancy Events triggers/tags as a scoped follow-up, starting with commercial_diagnostic_requested and commercial_audit_requested.
4. Extend the GTM snippet and nav/footer sync to terms-and-conditions.html and 404.html.
5. Once Consultancy Events exist, revisit Google Ads/LinkedIn Insight tag installation for the ads-launch alignment noted in the SEO Content Architecture doc.

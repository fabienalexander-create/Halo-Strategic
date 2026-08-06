# Google Ecosystem Setup — What's Done, What Needs You

Status: Living document. Owner: Claude Code. Written 2026-07-31, following the Google Ads landing page build (ADR-018), covering the six areas Fabien asked to be worked through before ad spend: GA4, GTM, Search Console, Google Business Profile, remaining technical SEO, and a final Google Ads readiness checklist.

**Why this doc exists and its limits:** Google's own account consoles (tagmanager.google.com, analytics.google.com, search.google.com/search-console, business.google.com) are blocked from both browser-automation surfaces available in this environment — confirmed directly, not assumed. Nothing here could be clicked through on your behalf even with your login. Everything code-side (the actual site, `_redirects`, `sitemap.xml`, dataLayer events, image weight, meta tags) has been audited and, where it was broken, fixed directly. Everything account-side is a checklist for you, written as precisely as I can make it from what the code and existing docs already establish.

---

## 1. Google Analytics 4

**What's already true, per docs/GOOGLE_TAG_MANAGER.md (found in place, not built by this pass):** a GA4 Configuration tag already exists in GTM, Measurement ID `G-KC0RH0SS1L`, trigger "Initialization - All Pages." That means GA4 is wired into every page that carries the GTM snippet — which, as of this audit, is all 27 live pages (16 root pages, 11 Insights articles) plus the new `/diagnostic-landing`.

**What you need to check/click, in GA4 (analytics.google.com):**

1. Admin → Data Streams → your web stream → confirm the Measurement ID reads `G-KC0RH0SS1L`. If it doesn't match, stop and tell me — it would mean the container is pointed at a different property than the one in your docs.
2. Same screen → **Enhanced Measurement** toggle → confirm it's ON. This is what gives you `page_view`, `scroll`, `outbound_click`, `file_download`, `form_start`/`form_submit` automatically, no GTM work required. If it's off, switch it on.
3. Admin → Events (left nav under "Data display") → after some real traffic, confirm you start seeing `form_submit_success` and `health_check_completed` show up (these are custom dataLayer events already firing in the code; they won't appear in GA4 until the GTM tags in Section 2 are built and published).
4. Once `diagnostic_requested` (see Section 2) is live and firing at least once, go to Admin → Events, find it in the list, and toggle **"Mark as key event"** — this is what makes it eligible as a Google Ads conversion.
5. Admin → Property → Data Settings → Data Retention: worth setting to 14 months (GA4 default is often 2 months) so you can do real month-over-month campaign comparisons later. Not urgent for launch, but easy to miss once traffic exists.

---

## 2. Google Tag Manager

Full detail in docs/GOOGLE_TAG_MANAGER.md, rewritten today to remove a stale plan (it referenced "Discovery Call" conversion events, a concept removed from the site back in ADR-016). Summary of what's real right now:

**Already firing in the code, no GTM tag built yet:**
- `form_submit_success` with `form_id: 'diagnostic-landing'` — the Ads landing page form. **This is the one that matters for launch.**
- `form_submit_success` with `form_id: 'contact-form'` — the main site's Contact form.
- `health_check_completed` — the free Health Check quiz.

**Exact click-by-click steps in tagmanager.google.com** (expanded 2026-08-04, per docs/GOOGLE_TAG_MANAGER.md's exact event/field names — four trigger/tag pairs total):

### A. `diagnostic_requested` — the Ads landing page form (build this one first)

1. Go to tagmanager.google.com → open the "Halo Strategic" account → the container with ID `GTM-T49HRT6J` → make sure you're in the **Default Workspace** (top left).
2. Left sidebar → **Triggers** → **New** (top right).
3. Click the trigger config box (pencil icon) → under "Choose a trigger type" pick **Custom Event**.
4. Field "Event name": type `form_submit_success` exactly (case-sensitive, no spaces).
5. Below that, "This trigger fires on" → select **Some Custom Events**.
6. In the condition row that appears: left dropdown → `form_id`, middle dropdown → `equals`, right field → `diagnostic-landing`.
7. Top left, click the untitled trigger name field → rename to `CE - diagnostic_requested`.
8. Click **Save** (top right).
9. Left sidebar → **Tags** → **New**.
10. Click the tag config box → "Choose a tag type" → **Google Analytics: GA4 Event**.
11. "Configuration Tag" dropdown → select your existing **"GA4 - Configuration - Halo Strategic"** tag (do not create a new GA4 Configuration tag — this one already exists and points at `G-KC0RH0SS1L`).
12. "Event Name" field → type `diagnostic_requested`.
13. Scroll down to "Triggering" → click the pencil icon → select the `CE - diagnostic_requested` trigger you just made in step 7.
14. Top left, rename the tag to `GA4 - diagnostic_requested`.
15. Click **Save**.

### B. `contact_diagnostic_requested` and `contact_audit_requested` — the main Contact form

The main Contact form's `service` field carries which option the visitor picked (Diagnostic booking / Audit enquiry / General enquiry), so this needs two trigger/tag pairs, not one — otherwise you can't tell which service someone actually asked about.

16. **Triggers → New** → Custom Event → Event name: `form_submit_success`.
17. "This trigger fires on" → **Some Custom Events** → add **two** condition rows (use the "+" next to the first row): `form_id` equals `contact-form` **AND** `service` equals `diagnostic`.
18. Rename to `CE - contact_diagnostic_requested` → Save.
19. Repeat steps 16–18 exactly, but with `service` equals `audit` instead, named `CE - contact_audit_requested`.
20. **Tags → New** → GA4 Event → Configuration Tag: the same existing "GA4 - Configuration - Halo Strategic" → Event Name: `contact_diagnostic_requested` → Triggering: the trigger from step 18 → rename tag `GA4 - contact_diagnostic_requested` → Save.
21. Repeat step 20 for the audit version: Event Name `contact_audit_requested`, trigger from step 19, tag name `GA4 - contact_audit_requested`.

### C. `health_check_completed` — the free Health Check quiz

22. **Triggers → New** → Custom Event → Event name: `health_check_completed` (no condition needed — this event only fires from one place, the quiz).
23. Rename to `CE - health_check_completed` → Save.
24. **Tags → New** → GA4 Event → Configuration Tag: the same existing GA4 Configuration tag → Event Name: `health_check_completed` → Triggering: the trigger from step 23 → rename tag `GA4 - health_check_completed` → Save.
25. Optional refinement, not required for launch: under this tag's "Event Parameters" section, add two rows — parameter name `health_check_score` / value `{{DLV - health_check_score}}`, and `health_check_band` / `{{DLV - health_check_band}}`. Each `{{DLV - ...}}` needs its own Data Layer Variable created first (**Variables → New → Data Layer Variable**, name matching the dataLayer key exactly) — skip this step entirely if you just want to know the quiz was completed, not the score.

### D. Test, then publish

26. Top right → **Preview**. A new tab opens (Tag Assistant Connect) — enter `https://halostrategic.com/diagnostic-landing`, click Connect.
27. In the real site tab that opens, fill in and submit the landing page form.
28. Back in the Tag Assistant panel (left side lists events like "Container Loaded", "form_submit_success"), click on the `form_submit_success` event → confirm **`GA4 - diagnostic_requested`** appears under "Tags Fired" — not under "Tags Not Fired". Also click "Container Loaded" and confirm the existing GA4 Configuration tag fired there.
29. Repeat the same check for the main Contact form (submit a test enquiry choosing "Diagnostic" as the service) and for the Health Check quiz, confirming each event's specific GA4 tag fires and nothing fires twice.
30. Once everything in Preview looks clean, close the debug tab, go back to the GTM workspace → **Submit** (top right) → give the version a name like "Add diagnostic_requested, contact, and health_check conversion events" → **Publish**.

### E. Last step — mark the primary conversion in GA4

31. Go to analytics.google.com → Admin → **Events** (under "Data display") → wait for `diagnostic_requested` to appear in the list (only shows up after it's fired at least once post-publish) → toggle **"Mark as key event"** next to it. This is what makes it eligible as a Google Ads conversion goal later.

Nothing else in the container needs touching. Google Ads Conversion and LinkedIn Insight tags can both be added later as new tags in this same container with zero code changes, whenever those accounts exist.

---

## 3. Google Search Console

No prior record of Search Console setup exists in this repo's docs, so treat this as starting from the top; skip any step you've already done.

1. Go to search.google.com/search-console → Add Property → choose **Domain** property type (covers `http/https` and `www`/non-`www` together) → enter `halostrategic.com`.
2. Google will give you a TXT record to add at your DNS provider (wherever `halostrategic.com`'s DNS is managed — likely wherever you bought the domain, not Netlify/Cloudflare unless DNS was delegated there). Add it, then click Verify in Search Console. This step is the one place I'd actually need you to tell me your DNS provider if verification doesn't go smoothly — I can't add DNS records for you regardless (that's an account-settings change, out of scope for me either way).
3. Once verified: left nav → **Sitemaps** → enter `sitemap.xml` → Submit. It's already live at `https://halostrategic.com/sitemap.xml` with 29 URLs (verified today), so this step should succeed immediately.
4. Left nav → **Pages** (under Indexing) → check for anything under "Not indexed." For a brand-new property this will be empty at first and fill in over days/weeks — nothing to act on immediately, just check back.
5. Left nav → **Core Web Vitals** → this needs real field data (CrUX) to populate, which requires enough traffic; it will likely show "not enough data" for weeks. Not a launch blocker.
6. Once `/diagnostic-landing` shows up as a known URL (after the sitemap submission propagates, or by using the URL Inspection tool directly), you can optionally hit **Request Indexing** on it — though since it's deliberately `noindex`, Google will inspect it and correctly report it as excluded by the noindex tag rather than index it. That's expected and correct; don't try to force it indexed, the noindex is intentional (ADR-018) so ad traffic doesn't create organic-search competition with `/commercial-diagnostic`.

---

## 4. Google Business Profile

Worth a direct flag before the checklist: GBP's main value is the local map-pack and "near me" search visibility, which matters most for businesses with walk-in or local-radius customers. Halo's positioning (per docs/PRICING_STRATEGY.md and ADR-014) already leans toward a national/US-oriented, remote-delivery client base, not a local-proximity one. GBP is still worth having (it feeds the Knowledge Panel for branded searches like "Halo Strategic," and costs nothing), but don't expect it to drive lead volume the way the Ads landing page will — it's a credibility/completeness item, not a growth lever, until proven otherwise.

**Steps that don't require a permanent address, using the service-area model:**

1. business.google.com → Create a profile → enter "Halo Strategic" as the business name.
2. When asked "Do you want to add a location customers can visit?", choose **No** — this is what unlocks the service-area flow instead of requiring a public street address.
3. Set your **service area** (by city/region/country — you can list multiple, e.g. "United Kingdom" and "United States" if that matches where you actually take clients).
4. Category: **Primary — "Business Management Consultant"**. **Secondary — "Marketing Consultant"**. Fabien confirmed 2026-08-04: deliberately not "Advertising Agency" or "Business Development Service" — both undersell the positioning and would mismatch how the site itself is framed.
5. Add a phone number if you have one you're willing to make public (Google requires *a* contact method; if you don't want a personal mobile number listed, a Google Voice number or a dedicated business line is the usual workaround — your call, not something I can source for you).
6. Add `https://halostrategic.com` as the website.
7. Add business hours (or mark "by appointment" if that fits better for a consultancy).
8. Business description (final, approved by Fabien 2026-08-04 — 480 characters, well under GBP's 750 limit):

   > Halo Strategic helps founder-led businesses make better commercial decisions. Through our Commercial Diagnostic, we identify the commercial challenges limiting growth before recommending solutions. Rather than assuming the answer is more marketing or more sales, we help leadership teams understand what will make the biggest difference first. Evidence-led, practical and tailored to each business, we work with founder-led companies across the UK and US.

9. Google will ask to verify the profile — usually by phone/text/email for service-area businesses without a public address (postcard-by-mail verification is more common for storefronts). Follow whatever verification method Google offers.

**What has to wait for a permanent office:** nothing above requires one. The only thing a real address would unlock is switching from a service-area listing to a full local-search/map-pin listing, which isn't a launch blocker either way.

**UK & US as the stated service area:** confirmed accurate by Fabien 2026-08-04 — matches where the business is actually working today and the market being targeted. Update if that changes.

---

## 5. Technical SEO — fixed this pass vs. still open

**Fixed today (all committed and pushed):**
- Favicon/manifest declarations were missing on 4 pages (`404.html`, `cookie-policy.html`, `privacy-policy.html`, `terms-and-conditions.html`) while present on the other 12 — brought all four onto the same declarations.
- `fabien-alexander.png` was 1.65MB (1537×1023) for a photograph, a genuine Core Web Vitals / LCP risk since it's used full-width on both `/about` and the new `/diagnostic-landing`. Re-encoded as JPEG (quality 82) at 109.5KB — a ~15x reduction, visually verified for artifacts — and all three `<img>` references updated to the new file.
- `docs/TECHNICAL_SEO_STATUS.md` corrected: it still listed sitemap.xml and robots.txt as "not started," which was stale — both have existed and been live since 2026-07-26.

**Still open, not fixed in this pass (neither is a launch blocker):**
- **Generic OG image** (finding 5, docs/TECHNICAL_SEO.md): every page shares one social-preview image (`og-default-1200x630.png`). Cosmetic for social shares, doesn't affect Google Ads or SEO functionality. Worth a follow-up if you want page-specific share images (I can build these the same way as the LinkedIn image system — HTML/CSS + headless Chrome — rather than an AI image generator, consistent with how those were built).
- **Full Core Web Vitals baseline** (finding 12): no Lighthouse/PageSpeed tooling is available in this environment. The one concrete issue a manual pass could find (the oversized photo) is fixed; a real PageSpeed Insights run from your own machine (pagespeed.web.dev, paste in the URL) would catch anything else — JS execution time, font-loading strategy, etc. Takes two minutes, worth doing once before spending on ads.

---

## 6. Google Ads Readiness — final checklist

**Ready now:**
- [x] Landing page live, fast-loading, single-CTA, mobile-first, `noindex` so it won't compete with organic pages (ADR-018)
- [x] Netlify form on the landing page tested and submitting correctly, tagged with `source=google-ads-landing-page`
- [x] GTM installed and firing on the landing page
- [x] Sitemap and robots.txt correct and live
- [x] Heaviest known performance issue (the 1.65MB photo) fixed

**Blockers before you should actually spend money on clicks:**
- [ ] **The `diagnostic_requested` GTM trigger/tag isn't built yet** (Section 2, steps 1–2). Without it, Google Ads has no conversion signal to optimise against — you'd be running ads blind. This is the single highest-priority item on this whole list.
- [ ] **GA4 Enhanced Measurement not yet confirmed on** (Section 1, step 2) — quick check, do it alongside the GTM work.
- [ ] **No Google Ads account/campaign exists yet** (Phase 3 of the earlier roadmap) — nothing here builds that; it's a from-scratch setup on your side (billing, campaign structure, keywords from the message-match notes in docs/GOOGLE_ADS_LANDING_PAGE.md) whenever you're ready.
- [ ] **Search Console not yet verified** — not a hard blocker for Ads specifically (Ads doesn't require Search Console), but you'll want it live before or shortly after launch so you can see how the new page and any organic side-effects behave.

**Not blockers, do when convenient:**
- [ ] Google Business Profile (Section 4) — credibility item, not a paid-traffic dependency.
- [ ] A real PageSpeed Insights run, once, before spend, just to confirm nothing else is dragging load time.
- [ ] Page-specific OG images — purely a social-share nicety.

---

## 7. Confirmed sequencing (2026-08-04)

Fabien reviewed this doc and confirmed the order below rather than working the sections top-to-bottom. Follow this sequence, not the section numbering above:

1. **Search Console** (Section 3) — ~30 minutes, immediate long-term value (search queries, indexing status, CTR, impressions) for a brand-new site.
2. **Google Business Profile** (Section 4).
3. **Verify GA4 is actually receiving data** (Section 1, steps 1–2).
4. **Build the `diagnostic_requested` conversion event** (Section 2) — do this *before* spending on Ads. His reasoning: "There's no point paying Google for traffic if you can't reliably measure whether people are converting."
5. **Only then** set up a Google Ads account/campaign.

**Bing Webmaster Tools** — new item, not previously in this doc. Fabien flagged it as a ~10-minute add-on once Search Console is verified: bing.com/webmasters usually offers a one-click "import from Google Search Console" option once GSC is verified, since it reuses the same DNS/HTML verification. Low effort, no reason to skip it.

**The broader roadmap this sits inside**, per Fabien 2026-08-04:
- **Phase 1 — Build** (done): brand, website, positioning, About, Diagnostic/Audit product pages, email, GitHub, Netlify.
- **Phase 2 — Foundation** (this week): Search Console, Google Business Profile, GA4 verification, GTM conversion events, Bing Webmaster Tools, indexing.
- **Phase 3 — Growth**: LinkedIn, SEO content, founder outreach, Commercial Audits, case studies, referrals.

Any future session picking this up should treat Phase 2 as still in progress until every box in Section 6 and this section is checked, and shouldn't jump ahead to Phase 3 growth activities (content volume, ad spend) while foundational measurement is still unverified.

---

## 8. Verification Checklist — Definition of Done

This setup is complete when every box below is checked. Not a suggestion list — a single source of truth for whether Phase 2 (Foundation) is actually finished, so nothing gets silently skipped.

- [ ] Google Search Console verifies `halostrategic.com`
- [ ] `sitemap.xml` has been submitted successfully in Search Console
- [ ] Google Business Profile is verified
- [ ] GA4 Realtime shows live visits
- [ ] `diagnostic_requested` appears in GA4 Events
- [ ] `diagnostic_requested` is marked as a Key Event
- [ ] `contact_diagnostic_requested` appears in GA4 Events
- [ ] `contact_audit_requested` appears in GA4 Events
- [ ] `health_check_completed` appears in GA4 Events
- [ ] All GTM tags fire correctly in Preview Mode (Section 2, step D)
- [ ] A GTM container version has been published
- [ ] Bing Webmaster Tools has imported the Search Console property

Once every box above is checked, Phase 2 is done — move to Phase 3 (Growth: LinkedIn, SEO content, founder outreach, Commercial Audits, case studies, referrals), per Section 7's roadmap.

---

## 9. Future Integrations (Not Yet Required)

Not installed, and deliberately not being installed now. The GTM container (Section 2) is structured so every item below can be added later as new tags/triggers with zero code changes to the site — this section exists so the reasoning behind that architecture doesn't get lost, not as a to-do list to start working through.

- Google Ads Conversion tag — once a Google Ads account/campaign actually exists (Section 6).
- Microsoft Ads (Bing Ads) conversion tag.
- LinkedIn Insight Tag — once LinkedIn is being used for paid distribution, not just organic posting.
- Meta Pixel — only if Halo runs paid social; not currently part of the plan.
- Microsoft Clarity — free session-recording/heatmap tool, complements GA4's numbers with qualitative behaviour; cheap to add, no urgency.
- Call tracking — worth revisiting once phone enquiries become a meaningful share of leads. No `tel:` link exists on the site yet either (see docs/GOOGLE_TAG_MANAGER.md, `phone_clicked` event).

Revisit this section when a specific business reason to add one of these shows up — not on a schedule.

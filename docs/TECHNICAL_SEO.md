# Halo Strategic — Technical SEO Audit (Sprint 2.1)

Status: Immutable, findings as of audit date
Owner: Claude Cowork
Maintainer: Claude Cowork (Browser may append implementation status only, to docs/TECHNICAL_SEO_STATUS.md, never here)
Audit Date: 2026-07-26
Audited against: GitHub repository, commit `7c7dbc0`, cross-checked against the live production site at halostrategic.com
Version: 1.0

## Method and Scope

This audit is based on direct inspection of page source, not a crawler tool. Ten of twelve pages were fully inspected (index.html, about.html, contact.html, commercial-diagnostic.html, commercial-audit.html, how-halo-thinks.html, selected-engagements.html, privacy-policy.html, terms-and-conditions.html, 404.html). Two pages, cookie-policy.html and thank-you.html, were **not** directly inspected in this pass and are flagged as open items rather than assumed compliant.

A note on method, recorded because it materially affected this audit: an initial fetch of several pages via a branch-alias URL (`.../main/index.html`) returned stale, CDN-cached content that predated Sprint 0's reconciliation work, producing a false "major regression" finding. That finding was retracted after cross-checking against a pinned commit SHA and the live production site directly, which confirmed the site was in fact correctly reconciled. Every finding below is based on the pinned-commit or live-site check, not the stale fetch. This is noted so the lesson isn't lost: verify structural claims against a pinned commit or the live site, never a branch alias alone.

## Findings

### 1. Sitemap: missing

No `sitemap.xml` exists in the repository root. Confirmed by direct listing of the repository root at commit 7c7dbc0. This matches docs/IMPLEMENTATION_LOG.md's own note that sitemap.xml is "currently empty/missing." Search engines are currently relying entirely on discovery via internal links and any manually submitted URLs in Search Console.

### 2. Robots.txt: missing

No `robots.txt` exists in the repository root. Confirmed by direct listing of the repository root at commit 7c7dbc0. Not itself a defect (its absence does not block crawling), but it means there is no explicit sitemap pointer for crawlers and no way to control crawl behaviour if that becomes necessary later.

### 3. Meta descriptions: present and page-specific

Every page inspected (10 of 12) has a unique, non-templated `<meta name="description">`. No duplicate or missing descriptions found among the pages checked.

### 4. Canonical tags: present, self-referencing, correct

Every page inspected (10 of 12) has a `<link rel="canonical">` pointing to its own absolute `https://halostrategic.com/...` URL. No cross-page canonical conflicts found.

### 5. Open Graph / Twitter Card tags: present, but share one generic image site-wide

Every page inspected carries `og:title`, `og:description`, `og:type`, `og:url`, and Twitter Card tags, correctly page-specific for title and description. However, **every page points `og:image` and `twitter:image` at the same single asset**, `https://halostrategic.com/assets/og-default-1200x630.png`. A link to the Commercial Audit page and a link to the homepage will render an identical social preview image. This is a real, low-effort SEO/social finding: page-specific OG images (or even a generic-but-distinct one per major service page) would materially improve social share differentiation, particularly for Commercial Diagnostic vs. Commercial Audit, which are the two highest-intent pages on the site.

### 6. Structured data (schema.org / JSON-LD): none found

Zero `<script type="application/ld+json">` blocks exist on any of the 10 pages inspected. No Organization, LocalBusiness, FAQPage, or any other schema type is implemented anywhere on the site. This is the single largest structured-data gap on the site. commercial-audit.html in particular has a fully built, semantically correct `<details>/<summary>` FAQ block (five questions) that is a direct FAQPage schema candidate and currently earns zero rich-result eligibility from it.

### 7. Google Tag Manager coverage: incomplete

Container `GTM-T49HRT6J` (head script + body noscript iframe) is confirmed present and correctly placed on: index.html, about.html, how-halo-thinks.html, selected-engagements.html, privacy-policy.html (direct source verification). It is confirmed **absent** on terms-and-conditions.html and 404.html (direct source verification, both still carry the pre-Sprint-0 `<head>` with no GTM block). Presence on contact.html, commercial-diagnostic.html, commercial-audit.html, cookie-policy.html, and thank-you.html was not independently re-verified in this pass; docs/GOOGLE_TAG_MANAGER.md claims all five carry it, and earlier evidence (the Sprint 1B diff) shows contact.html, commercial-diagnostic.html, and commercial-audit.html built on top of a version of the shared template that already included GTM. Treat those three as likely correct and cookie-policy.html/thank-you.html as unconfirmed, and check all five explicitly in the next status update.

### 8. Navigation and footer consistency: two pages still out of sync

terms-and-conditions.html and 404.html both still carry the pre-Sprint-0, five-item nav (How Halo Works, Services, Commercial Audit, Evidence, About) and the pre-Sprint-0 footer sitemap (missing How Halo Thinks and Selected Engagements), confirmed by direct source inspection at commit 7c7dbc0. Every other page inspected (8 of 10) carries the correct, unified six-item nav and full footer sitemap. This matches, and confirms as still accurate, the gap already logged in docs/CURRENT_SPRINT.md.

### 9. Broken or placeholder links: none found

The two homepage Case Study card links previously flagged as broken (`href="#"`) are confirmed fixed, pointing to `selected-engagements.html#reacting-to-leading` and `#data-never-missing`. Both anchor IDs are confirmed to exist on selected-engagements.html. No other placeholder (`href="#"`) links were found on any page inspected.

### 10. Image alt text: correct on the images present

The site has very few `<img>` tags; almost all visual elements are inline SVG (correctly marked `aria-hidden="true"` for decorative marks) or CSS. The two real photographic images found (both on about.html, same source file used twice) carry distinct, descriptive alt text: "Fabien Alexander, Founder of Halo Strategic" and "Fabien Alexander speaking on stage at The Growth Summit 2026." No missing or generic alt text found.

### 11. Favicon/manifest declarations: inconsistent across pages

index.html, about.html, how-halo-thinks.html, selected-engagements.html, terms-and-conditions.html, and 404.html all declare a full icon set in `<head>` (favicon.ico, 16x16, 32x32, apple-touch-icon, site.webmanifest, theme-color). contact.html, commercial-diagnostic.html, commercial-audit.html, and privacy-policy.html do not declare any of these tags. In practice this has low real-world impact, browsers fall back to requesting `/favicon.ico` by convention, but it is a genuine template inconsistency worth folding into whatever pass next touches the shared header, rather than a functional SEO defect requiring urgent fixing on its own.

### 12. Core Web Vitals: not assessed

No performance/Lighthouse tooling was available in this environment to produce a Core Web Vitals spot-check. This remains open scope for Sprint 1, as originally noted in docs/IMPLEMENTATION_LOG.md.

### 13. Pages not covered by this audit

cookie-policy.html and thank-you.html were not directly source-inspected in this pass. Their GTM, nav/footer, and meta-tag status should be confirmed in the next audit update rather than assumed from pattern.

## Summary Table

| Area | Status | Pages affected |
|---|---|---|
| Sitemap | Missing | Site-wide |
| Robots.txt | Missing | Site-wide |
| Meta descriptions | Pass | 10/10 inspected |
| Canonical tags | Pass | 10/10 inspected |
| OG/Twitter tags | Present, generic image | 10/10 inspected |
| Structured data | Missing entirely | 10/10 inspected, site-wide |
| GTM coverage | Incomplete | Missing on terms-and-conditions.html, 404.html |
| Nav/footer consistency | Incomplete | Not yet applied to terms-and-conditions.html, 404.html |
| Broken links | Pass | None found |
| Image alt text | Pass | Both images checked |
| Favicon declarations | Inconsistent | Missing on 4 of 10 inspected |
| Core Web Vitals | Not assessed | Requires tooling not available here |
| cookie-policy.html, thank-you.html | Not audited | Open item |

This audit is a snapshot. It does not include implementation recommendations or priority sequencing, that belongs in docs/ROADMAP.md and in Browser's implementation planning once findings here are approved.

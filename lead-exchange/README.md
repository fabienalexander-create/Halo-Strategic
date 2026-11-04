# Halo Lead Exchange

A separate Next.js application living inside the `Halo-Strategic` repository, deployed as its **own
Netlify site** (not mixed with the main halostrategic.com deploy). This keeps the marketing site's
build and deploy completely untouched while this app grows independently.

Status: **Phase 2 (public pages) only.** No database, no authentication, no payment integration yet —
those are Phase 3/4, not started. The "Become a Buyer" and "Contact" forms currently submit via Netlify
Forms (same mechanism as the rest of halostrategic.com), with no backend processing beyond that.

## Linking this to the `halo-lead-exchange` Netlify site (one-time, manual — do this in the Netlify dashboard)

A new Netlify project called `halo-lead-exchange` already exists in your account
(https://app.netlify.com/projects/halo-lead-exchange), but it has no deploy yet because linking a site
to a Git repository + subfolder isn't something available through this session's tools. From the
Netlify dashboard, on the `halo-lead-exchange` project:

1. **Site settings → Build & deploy → Link site to Git** → choose the `Halo-Strategic` GitHub repo.
2. **Base directory:** `lead-exchange`
3. **Build command:** `npm run build` (already set in `netlify.toml`, Netlify should pick this up automatically once the base directory is set)
4. **Publish directory:** `.next` (also already set in `netlify.toml`)
5. Deploy. Netlify will install dependencies, build, and serve the app.
6. Once you're ready for a custom domain, add `leads.halostrategic.com` under **Domain management** on
   this site — Netlify will give you the exact DNS record to add in Cloudflare.

## Local development

```
cd lead-exchange
npm install
npm run dev
```

## What exists so far

- `/` — homepage
- `/spray-foam-removal` — the initial vertical landing page
- `/how-it-works` — the six-stage process
- `/become-a-buyer` — buyer application form (Netlify Forms, no backend yet)
- `/about`, `/contact` — draft placeholders
- `/refund-policy` — the confirmed Spray Foam Removal Replacement Policy (commercially confirmed, **not
  yet solicitor-reviewed** — do not treat as active/binding)
- `/privacy-policy`, `/buyer-terms`, `/lead-purchase-terms` — draft placeholders, explicitly marked as
  not yet written, linked from the footer so nothing 404s

## What does NOT exist yet (Phase 3 onward)

- Database (leads, buyers, payments, deliveries, consent_records, audit_log — see the Phase 1 proposal
  doc for the schema)
- Authentication / buyer portal
- Admin dashboard
- Payment integration (Tide or otherwise) — see the Phase 1 doc §9 for the open questions with Tide
  Business Support before any of this is built
- Any real homeowner or buyer data processing

Do not treat this as ready for real buyers or real homeowner data. It's the public-facing shell only.

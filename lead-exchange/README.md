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

## Required environment variables (set in Netlify dashboard → Site settings → Environment variables)

These are app-level secrets you generate yourself — never paste them into chat with me, and I won't
generate them for you either (this session's sandbox correctly blocks an agent from generating a
secret and then handling its own plaintext value, which is the right safety behaviour).

- `ADMIN_SESSION_SECRET` — any long random string (32+ characters). Signs admin session cookies.
  Generate one yourself, e.g. in a terminal: `openssl rand -base64 32`, or use a password manager's
  "generate password" feature with a long length.
- `ADMIN_SETUP_TOKEN` — a second, different long random string. One-time bootstrap token for creating
  the first admin account (see below). Once you've used it, you can delete this env var — the setup
  endpoint refuses to run a second time anyway, but removing it closes the door completely.

Mark both as **secret** values when adding them in Netlify.

## Creating the first (and only, for now) admin account

Once the site is deployed with the env vars above set, run this once (replace the placeholders):

```
curl -X POST https://leads.halostrategic.com/api/admin/setup \
  -H "Content-Type: application/json" \
  -H "x-admin-setup-token: <your ADMIN_SETUP_TOKEN value>" \
  -d '{"email":"you@halostrategic.com","password":"<a real password, 12+ characters>"}'
```

This only works once — a second call returns 409 once any admin account exists. After this, sign in
at `/admin/login`.

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
- `/become-a-buyer` — a **real, working** buyer application. Writes an actual `buyers` row via
  `/api/buyer-applications`, returns a real application reference (`HLX-BYR-000001` etc.), logs
  timestamped terms/policy agreement, computes an internal (never-shown) suitability score, and
  rejects duplicate applications from the same email. This is a database-backed workflow, not a
  Netlify Forms submission.
- `/admin/login`, `/admin` — real admin authentication: bcrypt-hashed passwords, HMAC-signed httpOnly
  session cookies, no public registration, server-side session verification on every admin API route
  (see `lib/requireAdmin.ts`). The `/admin` landing page itself is currently just a signed-in shell —
  application review, lead management, buyer profiles and inventory controls (Priorities 2-5) are not
  built yet.
- `/about`, `/contact` — draft placeholders
- `/refund-policy` — the confirmed Spray Foam Removal Replacement Policy (commercially confirmed, **not
  yet solicitor-reviewed** — do not treat as active/binding)
- `/privacy-policy`, `/buyer-terms`, `/lead-purchase-terms` — draft placeholders, explicitly marked as
  not yet written, linked from the footer so nothing 404s

## What does NOT exist yet

- Buyer application **review/approval** admin screen (applications currently land in the database with
  no way to see or act on them except a direct SQL query)
- Lead creation/management, buyer commercial-profile management, lead inventory dashboard (Priorities
  3-5)
- Buyer login/portal
- The 24-hour exclusive lead allocation engine (schema exists — `lead_allocations` with
  `allocation_sequence`/`reservation_expires_at` — but no matching logic or scheduled expiry job yet,
  deliberately: there are no real leads to allocate yet)
- Payment integration (Tide or otherwise) — see the Phase 1 doc §9 for the open questions with Tide
  Business Support before any of this is built
- Any real homeowner data processing

**Nothing in this app has been verified against a live production deploy yet** — the Netlify site has
never been linked to this repo (see the linking steps above), so there is no production database to
test against. Everything above has only been verified with a local build/typecheck. Do not treat any
of it as production-proven until that link happens and it's tested live.

# Halo Lead Exchange

A separate Next.js application living inside the `Halo-Strategic` repository, deployed as its **own
Netlify site** (not mixed with the main halostrategic.com deploy). This keeps the marketing site's
build and deploy completely untouched while this app grows independently.

Status (updated 2026-11-04): **deployed and live** at https://halo-lead-exchange.netlify.app — linked
to this repo's `main` branch, base directory `lead-exchange`. Admin authentication, a real
database-backed buyer application, and a Netlify DB (Postgres) production database all exist and are
confirmed working via live production testing (not just a local build). `leads.halostrategic.com` is
**not yet set up** — no Cloudflare DNS record exists for it. Use the `.netlify.app` URL below until
that custom domain is actually added under Domain management on this Netlify site.

## Linking this to the `halo-lead-exchange` Netlify site — already done

The site is linked and deploying automatically on every push to `main`. The steps below are kept for
reference only, in case the link ever needs to be redone:

1. **Site settings → Build & deploy → Link site to Git** → choose the `Halo-Strategic` GitHub repo.
2. **Base directory:** `lead-exchange`
3. **Build command:** `npm run build` (set in `netlify.toml`)
4. **Publish directory:** `.next` (set in `netlify.toml`)
5. Once ready for a custom domain, add `leads.halostrategic.com` under **Domain management** on this
   site — Netlify will give the exact DNS record to add in Cloudflare.

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

Once `ADMIN_SESSION_SECRET` and `ADMIN_SETUP_TOKEN` are set as env vars on the Netlify site (and a new
deploy has run since setting them — env var changes need a redeploy to take effect), run this once
(replace the placeholders):

```
curl -X POST https://halo-lead-exchange.netlify.app/api/admin/setup \
  -H "Content-Type: application/json" \
  -H "x-admin-setup-token: <your ADMIN_SETUP_TOKEN value>" \
  -d '{"email":"you@halostrategic.com","password":"<a real password, 12+ characters>"}'
```

(Once `leads.halostrategic.com` is set up as a custom domain, this URL changes to that — not before.)

**What this does, exactly:**
- Checks the `x-admin-setup-token` header against your `ADMIN_SETUP_TOKEN` env var, using a
  constant-time comparison (not a plain string equality check, which would leak timing information
  about how much of the token matched).
- Refuses outright (503) if `ADMIN_SETUP_TOKEN` isn't set at all on this deployment.
- Checks whether any row already exists in the `admin_users` table. If one does, it returns 409 and
  does nothing — **this is what makes it one-time**, not a time-based lock.
- If the token is valid and no admin exists yet, it hashes your password with bcrypt (12 rounds) and
  creates exactly one admin account with the `owner` role, then logs the creation in the audit log.

**Can it be used more than once?** No — not because of the token, but because of the `admin_users`
row-count check. Even with a valid token, a second call always returns 409 once the first admin exists.

**Does it create the account securely?** Yes, as far as the account-creation step itself goes: the
token check is constant-time, the password is bcrypt-hashed (never stored in plaintext), and the
resulting session cookie (once you log in) is HMAC-signed and httpOnly. The weakest link is the
password you choose — use something genuinely strong, this account can approve buyers and will
eventually gate real homeowner data.

**If the bootstrap fails (wrong token, weak password, network error):** nothing is created — the
`admin_users` table stays empty and you can just retry the same command. The failure modes that return
an error (400, 403, 503) never insert a row.

**If you succeed but then lose the password:** there's no password-reset flow yet (not built). Recovery
right now means deleting that one row from the `admin_users` table directly (via `netlify database
connect` from a machine with the Netlify CLI authenticated, or ask me once I have equivalent access)
and running the bootstrap command again — it only refuses while a row exists, so removing it reopens
the one-time window. This is a real gap worth closing (a proper password-reset flow) before this
account becomes load-bearing for daily operation.

After a successful bootstrap, sign in at `/admin/login`.

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

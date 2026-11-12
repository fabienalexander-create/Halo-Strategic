# Admin session hardening

Status: Option A (per-admin session version) is IMPLEMENTED on this branch (migration 20261112150000, see docs/ONBOARDING_CALL_ROLLBACK.md). Option B is deliberately not built. The comparison below is kept as the record of why.

Current state: sessions are signed cookies (HttpOnly, Secure, SameSite=Strict, scoped to the Lead Exchange path, 12 hour expiry). On every request the admin is looked up in `admin_users` and the live role is used, so demotion and deletion take effect immediately. Remaining gap: a copied cookie for an admin who is still valid works until it expires, and logging out does not invalidate it server-side.

## Option A: per-admin session version (recommended now)

- Add `session_version INTEGER NOT NULL DEFAULT 0` to `admin_users` (one small migration).
- Put the version in the token at login. `requireAdmin` already loads the admin row, so it compares versions with no extra query. A mismatch returns 401.
- Bump the version on: logout, password change, demotion, and an owner-triggered "sign out everywhere". Logging out then also kills any stolen copy of that admin's cookie.
- Effort: roughly 15 lines plus the migration and tests. Tokens issued before release have no version, so everyone logs in once.
- Limits: all of one admin's sessions go together (no per-device revoke, no "active sessions" list, no idle timeout).

## Option B: server-side session table

- Table `admin_sessions(id, admin_id, token_hash, created_at, last_seen_at, expires_at, revoked_at, ip, user_agent)`. The cookie holds a random opaque id, not a signed payload.
- Gives per-device revocation, an active-sessions list, idle timeouts and a security audit trail.
- Costs: login, logout and `requireAdmin` all change; a write per request if `last_seen_at` is tracked; expired-row cleanup; a small admin UI. Roughly 100 to 150 lines plus tests and a migration. It also makes the signed-cookie code and `ADMIN_SESSION_SECRET` redundant, which is a bigger blast radius for a change touching every admin request.

## Recommendation

Do Option A before any wider admin access (it is small and uses the lookup we already do). Move to Option B only when there are several admins or a real need for per-device control. Optional low-cost complement: reduce the 12 hour lifetime (for example 8 hours or an idle limit) once version checks exist.

## Technical debt noted

- No ESLint configuration exists (`next lint` prompts for setup). Worth adding separately; not a blocker for this change.

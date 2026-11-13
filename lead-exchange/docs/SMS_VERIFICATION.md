# Homeowner SMS verification (Step 2: Halo side only)

Status: built and tested locally. Not deployed. Nothing is live: no Make scenario, no TextMagic callback, no message to any homeowner.

## Safety gates (all must be true before a single text can be queued)
1. `SMS_VERIFICATION_ENABLED=true` (unset by default).
2. The lead's form version is in `SMS_NOTICE_VERSIONS` (lib/smsVerification.ts), i.e. it showed the approved phone verification notice. Only Solar & Battery version `2026-11-13-v0.2` qualifies. Spray foam, roofing and older solar leads are never texted. The notice is a transparency notice, not a tick box; the lawful basis is documented in the privacy policy (legitimate interest). Wording is approved by Fabien; a UK data-protection solicitor review of the final wording and processor arrangements is still recommended before activation.
3. For sending: `MAKE_SMS_OUT_WEBHOOK_URL` and `MAKE_SMS_OUT_SECRET` are set.

## Environment variables (set by Fabien, none set yet)
`SMS_VERIFICATION_ENABLED`, `MAKE_SMS_OUT_WEBHOOK_URL`, `MAKE_SMS_OUT_SECRET`, `SMS_INBOUND_SECRET` (inbound and delivery routes), `SMS_SENDER_SECRET` (retry route), optional `SMS_HOURLY_LIMIT` (default 100).

## What it adds
- Migration `20261113100000_sms_verification.sql`: `lead_phone_verifications`, `sms_suppressions`. Additive, rollback in the header.
- `POST /api/webhooks/sms/inbound` (body `{from, text, message_id}`), `POST /api/webhooks/sms/delivery` (`{message_id, status, detail?}`), both with header `x-halo-sms-secret`. `POST /api/sms/send-pending` with `x-halo-sms-secret` = `SMS_SENDER_SECRET`, for a scheduler to retry.
- Outbound hand-off to Make is signed: headers `x-halo-timestamp` and `x-halo-signature` (hex HMAC-SHA256 of `${timestamp}.${body}`), body `{verification_ref, to, text}`. Make should reply `{"message_id": "..."}`.
- The homeowner enquiry route queues a request inside its transaction (inside a savepoint, so the enquiry can never fail because of SMS) and makes one best-effort send after commit.

## Rules enforced in Halo
- Only a matched YES reply sets VERIFIED. Delivery receipts only set DELIVERED or FAILED.
- Every request has a 6 character reference (no look-alike characters, always at least one digit). One open request per lead (database index).
- A reply with a reference verifies only that request, and only from the same number. A bare YES verifies only if exactly one request is open for that number; otherwise nothing changes (AMBIGUOUS).
- Matching and state change are one UPDATE, so simultaneous replies verify once. Replayed provider message ids are no-ops.
- STOP writes `sms_suppressions` and closes open requests. Suppression is checked when queuing and again when the sender claims a row.
- Caps: 2 requests per number per 24 hours, a global hourly circuit breaker, UK mobiles only. Expiry 48 hours. Max 3 send attempts, 10 minute reclaim of stuck SENDING rows.
- Audit entries carry the reference only. No phone numbers or message text are logged.

## Not done (needs approval)
Make scenarios, TextMagic callbacks and top-up, env vars, the consent wording change on the form and privacy policy, a scheduler for the retry route, production deploy, old key rotation.

## Rollback
Unset `SMS_VERIFICATION_ENABLED` (instant, nothing sends). Full rollback: app rolled back first, then the DROP statements in the migration header.

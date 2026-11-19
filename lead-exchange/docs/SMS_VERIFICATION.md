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

## Meta follow-up SMS (Stage 1, separate from verification)
Status: built and tested locally on branch `meta-follow-up-sms`. Not deployed. Nothing sends.

Texts a spray foam homeowner whose Meta lead arrived missing qualification answers, with their
website completion link. Approved wording (Fabien, 2026-11-19, Option C) is in
`lib/metaFollowUpSms.ts` `followUpSmsText`.

Gates (all independent of `SMS_VERIFICATION_ENABLED`, so turning one on never turns on the other):
1. `META_FOLLOW_UP_SMS_ENABLED`: unset = off, `test` = test mode, `true` = live.
2. Test mode only queues or sends to `META_FOLLOW_UP_SMS_TEST_NUMBER`, which must be in Ofcom's reserved range 07700 900000-900999. Real numbers never get a row, so going live later can't release a test backlog. The sender re-checks at send time.
3. `META_FOLLOW_UP_LINK_KEY` (32+ chars). Without it no link can be derived, so nothing queues.
4. `MAKE_SMS_OUT_WEBHOOK_URL` / `MAKE_SMS_OUT_SECRET` (shared with verification).

Link storage: no working link is stored. Token = HMAC-SHA256(link key, nonce); `lead_sms_messages` keeps only the nonce, only while sendable, wiped in every other state (DB CHECK constraint). At send time the token is re-derived and checked against the lead's current hash, expiry and used flag; a reissued, completed or expired link is cancelled, not sent.

Reuses: STOP suppression list (inbound STOP also closes waiting follow-ups), 2-per-number-per-24h cap (counted across both outboxes), hourly circuit breaker, 3-attempt retry, delivery receipts, `POST /api/sms/send-pending` retry route.

Admin: `POST /api/admin/leads/[id]/follow-up-link` (and a panel in the leads queue) issues a fresh link for a QUALIFICATION_PENDING spray foam lead, invalidates the old one, cancels any unsent text, and queues a new text only if the switch allows. The URL is shown once, not stored.

Make "SMS out" payload for follow-ups: `{ reference, purpose: "META_FOLLOW_UP", to, text }` (verification texts keep `{ verification_ref, to, text }`). Make only needs `to` and `text`.

Migration `20261119100000_meta_follow_up_sms.sql`: additive. Rollback: unset the switch (instant); full rollback is app first, then `DROP TABLE lead_sms_messages;`.

Not done (needs approval): Make SMS-out/in scenarios, TextMagic callbacks, env vars, retry scheduler, consent/privacy-policy check for SMS on the Meta form, deploy, activation.

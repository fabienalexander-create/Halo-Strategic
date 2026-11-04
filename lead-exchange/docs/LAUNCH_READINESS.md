# Halo Lead Exchange — Launch Readiness

Tracks what's actually built and verified versus what's still ahead, so "built in code" never gets
read as "working in production." Updated as milestones land — this is a living checklist, not a
one-time plan.

## Status (as of 2026-11-04)

| Component | Status |
|---|---|
| Multi-industry database structure | Built in code — not yet deployed or tested |
| Buyer application (self-service) | Built in code — not yet deployed or tested |
| Industry-specific configuration (`industries` table) | Built in code — structurally supports solar as a second vertical, but the solar buyer journey and lead matching have never been exercised. Schema support is not the same thing as a tested workflow. |
| Admin authentication | Built in code — not yet deployed or tested |
| Production database (Netlify DB) | **Awaiting deployment.** Site has never been linked to this repo; `currentDeploy: {}` as of last check. Nothing below this line can be verified until this happens. |
| Admin application review queue | Not built |
| Lead management (manual entry, CSV import, qualification) | Not built |
| Buyer commercial-profile management | Not built |
| Lead inventory dashboard | Not built |
| Buyer login/portal | Not built |
| 24-hour exclusive allocation engine | Not built (schema groundwork exists) |
| Payment integration | Not built — blocked on Tide Business Support's answers (see the Phase 1 proposal doc §9) |
| Solar landing page / qualification form | Future phase — deliberately not started |

## The agreed next milestone (in order)

1. Link the Netlify site to this repo; set `ADMIN_SESSION_SECRET` and `ADMIN_SETUP_TOKEN`.
2. Verify in production: a real application saves, a buyer reference generates correctly, consent
   and application records persist.
3. Build the admin application queue + approval workflow.
4. Approve a real test buyer (James) and create a test spray foam lead.
5. Test the complete allocation and payment process **with test data only**.
6. Only then: real buyers, real homeowner data.

Do not skip ahead on this list. Each step depends on the one before it actually being verified, not
assumed.

## Launch requirements (not optional, not deferred to "later")

These apply before any real buyer transaction or real homeowner data moves through the platform —
confirmed 2026-11-04, in response to Fabien's point that reliability matters more than shipping a
week earlier:

- **Tested database backups.** Not just "backups exist" — an actual restore has been performed and
  verified to work, on this specific database, before it holds real data.
- **A documented recovery procedure.** What happens, step by step, if a deploy breaks the schema, a
  migration partially applies, or data needs restoring from a snapshot. Netlify DB supports snapshots
  (see Phase 1 proposal doc's Netlify DB skill reference) — the procedure for actually using one needs
  writing down and testing, not assuming it'll work when needed.
- **A clear financial reserve policy.** Given Tide's `Paid` / `Settled` / `In Review` distinction
  (Phase 1 §9) and the Replacement Policy's refund-vs-replacement mechanics, Halo needs a defined
  position on how much of received payment is actually available to the business at any time, versus
  held against disputes, reversals, or pending replacements. This is a commercial/financial decision
  for Fabien, not something to default silently in code.
- **Deploy-preview data isolation confirmed.** Netlify DB preview branches can contain copied
  production data, including real homeowner/buyer PII, and preview deploy links are public. Before any
  real data exists, confirm (and if necessary configure) that preview links aren't casually shared, and
  that nobody treats a preview branch as a safe place to poke around with production-shaped data.

None of these block Priorities 1-2 of the admin build (which use no real data yet). They block the
step from "test data" to "real buyers and real homeowners" — flagged here now so they don't get
discovered as a gap right before that step.

# Halo Strategic — Acquisition Signal Processing Operating Manual v1.0

Status: Living Document
Owner: Claude (daily inbox/CRM sweep routine)
Approved by: Fabien, 2026-09-24
Applies to: LinkedIn job-alert emails, Indeed job-alert emails, CommissionCrowd notifications, and any future inbound hiring/business-opportunity signal source feeding the Smartsheet acquisition system ("04 Hiring Signals", "05 CommissionCrowd").

## Purpose

Not every inbound signal is a Halo Strategic consulting prospect. Some are paid freelance/contract work Fabien can personally deliver. Conflating the two wastes research effort and can produce outreach that misreads the opportunity. This doc defines the decision tree that must be applied before any signal is researched, enriched, or written to Smartsheet.

## IMPORTANT: Two types of opportunity

When processing a LinkedIn / Indeed / CommissionCrowd signal, do not assume every opportunity is a Halo consulting prospect. There are two valid outcomes, and a signal can qualify for both.

### 1. HALO OPPORTUNITY

The company shows a commercial signal (e.g. a hiring pattern, an expansion, a structural change) that may indicate a problem Halo Strategic can diagnose or solve — sold as consulting/advisory work, not as Fabien personally doing the job.

Path: Research company → identify decision-maker → form a commercial hypothesis → write to Smartsheet ("04 Hiring Signals" or "05 CommissionCrowd") → REVIEW → potential Halo outreach (never automatic — see Non-negotiables below).

### 2. FREELANCE / CONTRACT OPPORTUNITY

The company is actively advertising for work that Fabien can personally deliver as a freelancer or contractor. This is direct income for Fabien/Halo, not a consulting-diagnosis play, though it can become one later.

Examples of roles that qualify: growth strategy, performance marketing, paid acquisition, demand generation, sales/business development, commercial strategy, RevOps/CRM, marketing operations, campaign management, AI/automation, fractional growth leadership, account/client strategy.

Path: Flag as FREELANCE OPPORTUNITY. Do not convert it into a Halo consulting lead merely because it surfaced in the signal system. Preserve: job URL, requirements, company, role, contract/freelance status, and application deadline. Send to REVIEW for Fabien to decide whether to apply.

### A signal can be both

A company can qualify as a freelance opportunity now *and* a potential Halo relationship later (e.g. Fabien takes the contract role, and the relationship becomes a future Halo lead once inside). Flag both when evidence supports it — don't force a single label.

## The decision tree

```
JOB / SIGNAL FOUND
  │
  ├─ Could Fabien actually deliver this personally (skills + capacity)?
  │     YES → FREELANCE REVIEW
  │
  ├─ Does the underlying hiring/business signal indicate a commercial
  │   problem Halo could investigate (independent of whether Fabien
  │   could do the advertised role himself)?
  │     YES → HALO REVIEW
  │
  └─ Neither?
        → PARK (surface only if the user's personal job-alert search
          asked for it; otherwise no action)
```

YES + YES is a valid, and valuable, outcome: flag both — freelance application as one line of the row, potential Halo relationship as another.

## Non-negotiables

- Do not automatically apply to a freelance/contract role.
- Do not automatically contact the employer for either path.
- Human (Fabien) approval is required before any application or outreach, in both funnels, without exception.
- A general/unverified inbox (e.g. `info@company.com`) is never used for outreach just because it's the only thing available — surface it as an option, but outreach still needs Fabien's explicit go-ahead on that specific inbox and that specific copy.
- Every Halo-hypothesis writeup must be framed as a question to validate with the company, never as an assumed diagnosis ("this should be validated with the founders," not "they have a problem with X").

## Why this matters

Halo doesn't have to produce every pound of near-term income. The same signal-sourcing engine that finds Halo prospects can find contract income for Fabien while Halo's pipeline develops. Keeping the two funnels distinct means:
- Freelance opportunities aren't diluted into over-eager consulting pitches.
- Halo opportunities aren't undersold as "I can do your job posting for you."
- Fabien's CV (a separate, hands-on-delivery-focused asset — see internal CV project) is the conversion asset for the freelance funnel; the Smartsheet commercial-hypothesis writeup is the conversion asset for the Halo funnel.

## Smartsheet homes

- Halo Opportunity → "04 Hiring Signals" (sheet ID 1404183690563460) or "05 CommissionCrowd" (sheet ID 5069268262801284), both in the "Halo Acquisition System" workspace.
- Freelance/Contract Opportunity → "06 Freelance Opportunities" (sheet ID 5192907553460100, same workspace), created 2026-09-24. Columns: Company, Role, Job URL, Contract/Freelance Type, Deadline, Could Fabien Deliver (Y/N + Why), Dual-Track (Halo Potential), Status, Next Action.
- A dual-track signal (both funnels apply) gets a row in both sheets, cross-referenced by company name — there's no single combined sheet.

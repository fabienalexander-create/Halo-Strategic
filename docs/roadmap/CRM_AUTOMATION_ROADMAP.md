# CRM & Enquiry Automation Roadmap

Status: **Planning only. Implementation deferred.**
Reason: Halo's product and operating model are still evolving. Automating too early risks rebuilding this within a month, once real client volume reveals what actually needs automating and what doesn't.

This document defines Halo's future enquiry automation architecture. It is a design document only. **No implementation should begin until this document is explicitly approved**, and even then, phase by phase, not all at once.

*Distinct from `docs/ROADMAP.md`: that document tracks Halo's actual sprint plan (what's being built now). This folder, `docs/roadmap/`, holds longer-horizon capability designs that are deliberately not scheduled yet, a library of future systems, not a queue of upcoming work.*

---

## Objectives

The system should:

- Capture every enquiry.
- Never lose a lead.
- Create a premium founder experience.
- Minimise manual administration.
- Support future AI-assisted diagnostics.
- Scale without changing the client experience.

---

## Phase 1 (Current) — Manual workflow

```
Website Form
    ↓
Netlify Forms
    ↓
Email Notification
    ↓
Fabien Reviews
    ↓
Personal Response
    ↓
Diagnostic Booked Manually
```

**Status: ✅ Current.** This is what's actually live today (see `index.html`'s Netlify form, `docs/ARCHITECTURAL_DECISIONS.md` ADR-004 for the no-CMS/no-backend reasoning that also applies here).

## Phase 2 — CRM integration

Potential options: GoHighLevel, HubSpot, Airtable.

```
Form
    ↓
CRM Contact
    ↓
Opportunity Created
    ↓
Pipeline Stage: New Enquiry
```

## Phase 3 — Email automation

Immediately send:

- Thank you
- What happens next
- Halo philosophy
- Expected response time

## Phase 4 — AI Enquiry Brief

Automatically generate, for internal use only:

```
Prospect Summary
    Business
    Industry
    Problem
    Possible hypotheses
    Suggested opening questions
    Relevant Halo frameworks
    Potential case studies
    Potential Selected Engagements
```

## Phase 5 — Founder Dashboard

Dashboard showing:

- New enquiries
- Response times
- Pipeline
- Win rate
- Revenue
- Diagnostics completed
- Average response time

## Phase 6 — Proposal Generation

After a Diagnostic, AI assists with creating:

- Executive Summary
- Findings
- Recommendations
- Proposal

Fabien reviews before sending. Always.

## Phase 7 — Knowledge Base

Every completed engagement contributes to Halo's knowledge base. Future AI can recommend:

- Similar engagements
- Relevant Insights articles
- Frameworks
- Diagnostic questions

---

## Design Principles

The system must:

- ✓ Never replace human judgement.
- ✓ Automate administration.
- ✓ Never automate diagnosis.
- ✓ Keep founders speaking to people.
- ✓ Support "Diagnosis Before Prescription" (Halo's First Law, `docs/HALO_BIBLE.md`).

## Future Integrations (potential, not decided)

Netlify Forms, Zapier, Make, GoHighLevel, HubSpot, Gmail, Google Calendar, OpenAI, Slack, Microsoft Teams.

---

## Status

```
Status:          Planning Only
Implementation:   Deferred
Reason:           Halo product and operating model still evolving.
```

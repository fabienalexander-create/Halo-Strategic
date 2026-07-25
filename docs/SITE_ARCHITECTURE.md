# Halo Strategic — Site Architecture

Current sitemap, as it exists right now, before Sprint 0 changes:

```
Halo Strategic (halostrategic.com)

Home (index.html)
├── Commercial Diagnostic (commercial-diagnostic.html)
├── Commercial Audit (commercial-audit.html)
├── Selected Engagements (selected-engagements.html)
│     6 real Growth Stories, anchor-linkable
├── How Halo Thinks (how-halo-thinks.html)
├── About (about.html)
├── Contact (contact.html)
├── Privacy Policy (privacy-policy.html)
├── Cookie Policy (cookie-policy.html)
├── Terms & Conditions (terms-and-conditions.html)
├── Thank You (thank-you.html)
└── 404 (404.html)
```

Every page above already exists live. The problem Sprint 0 fixes isn't missing pages, it's that three of these pages (Selected Engagements, How Halo Thinks, and to a lesser extent About) were built on a different template than the other five, so navigation and footer don't currently agree across the site. Full detail in RECONCILIATION_REPORT.md.

## After Sprint 0

Same pages, one shared navigation, footer, and design system across all of them. No structural additions, this sprint is consistency, not new pages.

## Where future sections fit

**Insights** (blog/article hub). Sits as a new top-level nav item, alphabetically or logically between How Halo Thinks and About. URL: `/insights/` as an index page, individual articles at `/insights/[slug]`. This is the section the SEO Content Architecture v1.1 document is built around, none of it exists yet, it's the prerequisite build item noted in that document. Each article links back to its Topical Authority Map pillar and to the relevant Selected Engagement.

**Framework Library**. Not a new nav item on its own to start, closer scope: a section within Insights or a dedicated `/how-halo-thinks/` expansion, since How Halo Thinks already holds Halo's distilled principles. The six Halo IP ideas from the Operating Manual (Decision Leadership Over Execution, Second Pair of Eyes Not an Oracle, the Confidence Ledger, Translation Over Access, Price the Risk You Actually Carry, the Feedback-Loop Gate) would live here, each as its own short page. Links out to Selected Engagements stories that demonstrate each framework in practice.

**FAQ Hub**. Commercial Audit already has a page-level FAQ. A dedicated hub makes sense once there are FAQs across multiple services worth centralising, not before. Until then, keep FAQs embedded in their relevant service page (as Commercial Audit already does) rather than fragmenting them into a separate destination too early.

**Resources**. Lowest priority of the four, and the vaguest. Would hold downloadable material (templates, checklists) once there's a real lead-magnet strategy, the SEO Content Architecture document deliberately recommends against building lead magnets until there's an email nurture sequence to route them into. Revisit after Insights and the Framework Library exist.

Suggested nav order once Insights exists: How Halo Works · Services · Commercial Audit · Insights · Selected Engagements · How Halo Thinks · About. Framework Library and FAQ Hub stay nested rather than adding more top-level items, a nav with eight or nine top-level links stops being usable.

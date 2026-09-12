# US HVAC Lead Generation — Competitor Research

Status: Research pass, built 2026-09-12. Feeds `BRIEF.md` §10. Findings below are from live web search this session, sources linked per section; nothing here is invented or extrapolated beyond what the sources say.

## 1 — The market, by model

Three distinct models exist, worth telling apart because Halo's offer doesn't cleanly match any of them:

**Shared-lead marketplaces** (Angi, HomeAdvisor, Thumbtack, CraftJack — now absorbed into Angi, Networx, Modernize). Homeowner submits one form, it's sold to 3-4 competing contractors simultaneously. Pricing $10-$100/lead depending on trade and platform. [Iconic](https://iconic.co/blog/hvac-lead-brokers/), [Skill Mammoth](https://skillmammoth.com/blog/where-to-buy-hvac-leads), [Networx](https://www.networx.com/networx-leads)

**Exclusive-lead / appointment-setting vendors** (Minyona, Peak Marketing Service, 33 Mile Radius, Abstrakt, Calling Agency). One contractor per lead, sometimes one contractor per entire territory. Pricing runs $41-$200/lead or $75-$150+ per booked appointment. Some (Abstrakt) work one HVAC partner per geographic market, closer to an exclusivity model than a per-lead vendor. [Minyona](https://minyona.com/hvac-leads), [33 Mile Radius](https://www.33mileradius.com/hvac-leads/), [Abstrakt](https://www.abstraktmg.com/industries/hvac-leads/)

**Paid channels HVAC companies run themselves** (Google Local Services Ads, Google Ads). LSA averages $72-$180/lead; Google Ads blended CPL around $104, with non-branded search as high as $149. [Astra](https://astraresults.com/blog/post/june-2026/hvac-cpl-benchmark), [PipelineOn](https://pipelineon.com/blog/hvac-leads-guide/)

**Where Halo's offer sits:** priced at $150/opportunity, Halo is positioned right in the middle of the exclusive-lead tier, above shared marketplaces, competitive with Minyona/33 Mile Radius, and cheaper than most Google-channel CPLs. That's a defensible price point, not obviously underpriced or overpriced against the market, but it means price alone isn't the differentiator, execution and trust are.

## 2 — What HVAC contractors actually complain about

This is the most useful finding for creative (§ in `CREATIVE_CONCEPTS.md`), these are real, sourced objections, not invented pain points:

- **Fake and dead leads.** Contractors report leads with disconnected numbers, or homeowners who say they hired someone weeks ago. [Skill Mammoth](https://skillmammoth.com/blog/where-to-buy-hvac-leads)
- **Paying regardless of outcome.** HomeAdvisor charges every contractor for the same shared lead "regardless of which one actually wins it." Reported figure: 99% of some leads either don't answer or weren't actually looking for a contractor. [BusinessDen](https://businessden.com/2018/07/23/contractors-sue-homeadvisor-say-sites-leads-are-overwhelmingly-bogus/)
- **No recourse for bad leads.** Contractors report lead services not crediting back fake or wrong-number leads. [Skill Mammoth](https://skillmammoth.com/blog/where-to-buy-hvac-leads)
- **This isn't a fringe complaint, it's an FTC matter.** The FTC filed a formal complaint against HomeAdvisor alleging false/misleading/unsubstantiated claims about lead quality and source, dating back to 2014. [FTC](https://www.ftc.gov/node/78625)
- **Low close rates on shared leads.** Shared leads reportedly close at 10-20%, pushing true cost-per-signed-job to $150-$600 for a trade like HVAC once the shared-competition dynamic is priced in. [PipelineOn](https://pipelineon.com/blog/thumbtack-alternative/)

This is a genuinely strong, evidenced angle for Halo: the market's biggest, most legitimate complaint (paying for leads that don't answer, sharing the same homeowner with 3 competitors) is exactly the thing Halo's model claims to fix (exclusive, qualified, callback-ready). That claim needs to actually hold up in delivery, not just in the ad, or Halo becomes one more entry on this same complaint list.

## 3 — Job economics (for creative and pricing context, not for making promises)

- Average HVAC service ticket: **$340**. [Workyard](https://www.workyard.com/construction-management/hvac-facts-statistics)
- Installation gross margins: **28-45%** depending on job type. [SubcontractorHub](https://www.subcontractorhub.com/blog/how-to-price-hvac-jobs)
- Reported customer lifetime value: **~$15,340** against a **$296-$350** customer acquisition cost (industry-wide, not Halo-specific). [BaaDigi](https://www.baadigi.com/blog/hvac-business-benchmarks-2026-revenue-profit-margins-conversion-rates)

**Per `BRIEF.md` §4's non-negotiable:** these are industry benchmarks, not a promise about what any specific HVAC buyer will earn from Halo's leads. Any creative referencing job value (Concept E) must frame this as market context ("the average HVAC job is worth $340, an install considerably more"), never as "you'll make $X from every $150 opportunity," which would be an unsupported earnings claim.

## 4 — Two gaps this research surfaces, not previously flagged

**1. The compliance finding actually changes the architecture, not just the paperwork.** A January 2026 FCC rule holds that consent captured on a lead-gen form, comparison-shopping site, or through a third party can't be reused by a different downstream business, each brand needs its own direct consent from the homeowner. [Plura](https://www.plura.ai/articles/tcpa-consent-requirements-2026), [Infobip](https://www.infobip.com/blog/tcpa-compliance-sms) Statutory penalties run $500-$1,500 per message with no cap. This means: **if Halo ever buys, aggregates, or resells homeowner contact data sourced from someone else's consent capture, the AI-SMS qualification step in `BRIEF.md` §8 is a real legal liability, not a technical detail.** Halo must capture its own direct consent, from its own homeowner-facing channel, at the point the homeowner submits their information, and retain that record for 5+ years. This needs a lawyer's sign-off before any AI SMS goes live, not an assumption that "we'll add a checkbox."

**2. `BRIEF.md` specifies the sell-side (LinkedIn → HVAC firms) in detail but never specifies the demand-side (how Halo actually generates the homeowner leads it's promising to deliver).** This is a second, entirely separate acquisition engine, its own channel, creative, landing page and CAC, that the current brief assumes exists rather than defines. Before the first paid HVAC trial is sold, Halo needs a working, tested answer to "where do the 5 homeowner leads actually come from," Google/Meta ads to homeowners, SEO, a referral arrangement, something else, since the whole commercial promise depends on that engine actually working, independent of whether the LinkedIn side sells the trial successfully.

## 5 — What this means for Halo's positioning

Given §2's finding that the market's dominant complaint is exactly what Halo claims to solve, and §1's finding that Halo's $150 price point sits mid-market rather than as a discount play, the honest differentiation is **execution and proof, not price or a new pitch.** Whatever creative gets built (`CREATIVE_CONCEPTS.md`) should lean on specificity (a named callback window, confirmed exclusivity, visible no-fake-lead policy) rather than generic "better leads" claims every competitor in §2 already makes and has already been sued over.

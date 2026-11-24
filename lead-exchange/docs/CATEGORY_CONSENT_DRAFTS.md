# Prepared categories: drafts for approval

Status: DRAFT. None of this is wired into the application. Windows & Doors and Insulation stay `prepared` in `lib/industries.ts` (no public form, no enquiries, no buyers, no allocation) until Fabien approves the items below and there is a buyer for the category. Legal review before launch.

## To go live, each category needs

1. Approved homeowner consent wording (below), added to `HOMEOWNER_CONSENT_CONFIG` with a new consent version.
2. A decision on the buyer replacement policy: extend the published Lead Replacement Policy (today Solar & Battery and Roofing) to the category, or record `NOT_YET_PUBLISHED` and agree terms individually, as the other categories did before their policies were published.
3. Approved qualification questions (below).
4. At least one buyer who covers the area and agrees a price. No default prices are set.
5. Status changed to `live` in `lib/industries.ts` and `industries.is_enabled` set to true. `GET /api/admin/categories` must then report no errors.

## Windows & Doors (draft)

- Consent tick-box label: "I'm happy for my details to be shared with one or more suitable window and door installers, so they can contact me about this enquiry, if Halo Strategic identifies them as a genuine fit."
- Recorded recipient category: "One or more approved Windows & Doors installers in the Halo Lead Exchange, only those judged a genuine fit"
- Source: `windows_doors_homeowner_form`. Consent version: assigned on approval.
- Proposed qualification questions:
  - `work_type`: What do you need? (Replace existing windows / Replace existing doors / Both / New openings / Repairs)
  - `number_of_units`: Roughly how many windows or doors? (1-2 / 3-5 / 6-10 / More than 10 / Not sure)
  - `frame_material`: Preferred frame material, if known (uPVC / Aluminium / Timber / Composite / Not sure)
  - `timeframe`: When would you like the work done? (As soon as possible / Within 3 months / 3-6 months / Just researching)

## Insulation (draft)

Scope: new insulation installation only (loft, cavity wall, external wall). Spray foam removal stays a separate category.

- Consent tick-box label: "I'm happy for my details to be shared with one or more suitable insulation installers, so they can contact me about this enquiry, if Halo Strategic identifies them as a genuine fit."
- Recorded recipient category: "One or more approved Insulation installers in the Halo Lead Exchange, only those judged a genuine fit"
- Source: `insulation_homeowner_form`. Consent version: assigned on approval.
- Proposed qualification questions:
  - `insulation_type`: What type of insulation are you interested in? (Loft / Cavity wall / External wall / Not sure)
  - `property_age`: Roughly when was the property built? (Before 1930 / 1930-1975 / 1976-2000 / After 2000 / Not sure)
  - `existing_insulation`: Is there any insulation there now? (None / Some, but old or thin / Yes / Not sure)
  - `timeframe`: When would you like the work done? (As soon as possible / Within 3 months / 3-6 months / Just researching)

## Future categories

Heat Pumps, Kitchens and Bathrooms are placeholders only (`future`). No wording, questions or pricing are drafted yet.

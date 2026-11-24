import { describe, expect, it } from 'vitest';
import {
  BUYER_REPLACEMENT_POLICY_CONFIG, CATEGORIES, HOMEOWNER_CONSENT_CONFIG, INDUSTRY_LABELS, LIVE_CATEGORIES,
  categoryLabel, getCategory, isConfiguredIndustrySlug,
} from './industries';
import { checkCategoryConsistency, IndustryRow } from './categoryConsistency';

describe('central category registry', () => {
  it('has unique, well-formed slugs', () => {
    const slugs = CATEGORIES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z_]+$/);
  });

  it('keeps exactly the three existing live categories, unchanged', () => {
    expect(LIVE_CATEGORIES.map((c) => c.slug)).toEqual(['spray_foam_removal', 'solar_battery', 'roofing']);
    expect(INDUSTRY_LABELS).toEqual({ spray_foam_removal: 'Spray Foam Removal', solar_battery: 'Solar & Battery', roofing: 'Roofing' });
  });

  it('prepares Windows & Doors and Insulation, and holds Heat Pumps, Kitchens and Bathrooms as future', () => {
    expect(CATEGORIES.filter((c) => c.status === 'prepared').map((c) => c.slug)).toEqual(['windows_doors', 'insulation']);
    expect(CATEGORIES.filter((c) => c.status === 'future').map((c) => c.slug)).toEqual(['heat_pumps', 'kitchens', 'bathrooms']);
    expect(getCategory('insulation')?.scope).toMatch(/installation only.*loft, cavity wall and external wall/i);
  });

  it('only live categories pass the gate every intake, buyer and allocation path uses', () => {
    for (const c of CATEGORIES) expect(isConfiguredIndustrySlug(c.slug)).toBe(c.status === 'live');
    for (const bad of ['', 'unknown', null, undefined, 42, 'Roofing']) expect(isConfiguredIndustrySlug(bad)).toBe(false);
  });

  it('every live category has approved consent and policy config; nothing else has consent wording', () => {
    for (const c of LIVE_CATEGORIES) {
      expect(HOMEOWNER_CONSENT_CONFIG[c.slug as keyof typeof HOMEOWNER_CONSENT_CONFIG]).toBeDefined();
      expect(BUYER_REPLACEMENT_POLICY_CONFIG[c.slug as keyof typeof BUYER_REPLACEMENT_POLICY_CONFIG]).toBeDefined();
    }
    expect(Object.keys(HOMEOWNER_CONSENT_CONFIG).sort()).toEqual(LIVE_CATEGORIES.map((c) => c.slug).sort());
  });

  it('carries the live qualification questions and service labels exactly as before the refactor', () => {
    expect(getCategory('spray_foam_removal')?.qualificationFields).toEqual([
      'foam_location', 'foam_type', 'reason_for_removal', 'timeframe', 'roof_access', 'previous_quotes',
      'bedrooms', 'foam_extent', 'loft_size_estimate', 'house_number_or_name',
      'calculator_in_area', 'calculator_estimate_available', 'calculator_estimate_shown',
    ]);
    expect(getCategory('solar_battery')?.qualificationFields).toEqual(['interest_type', 'roof_type', 'existing_solar', 'timeframe']);
    expect(getCategory('roofing')?.qualificationFields).toEqual(['work_type', 'roof_type', 'urgency', 'issue_description', 'timeframe']);
    expect(LIVE_CATEGORIES.map((c) => c.serviceRequirementLabel)).toEqual(['Spray Foam Removal', 'Solar & Battery Installation', 'Roofing']);
  });

  it('labels any stored slug, falling back to the slug itself', () => {
    expect(categoryLabel('roofing')).toBe('Roofing');
    expect(categoryLabel('windows_doors')).toBe('Windows & Doors');
    expect(categoryLabel('something_old')).toBe('something_old');
    expect(categoryLabel(null)).toBe('');
  });
});

describe('category consistency check', () => {
  const allRows = (): IndustryRow[] => CATEGORIES.map((c) => ({ slug: c.slug as string, name: c.label, is_enabled: c.status === 'live' }));

  it('passes when the database matches the registry', () => {
    expect(checkCategoryConsistency(allRows())).toEqual({ ok: true, errors: [], notes: [] });
  });

  it('flags a registry category missing from the database, and a database category missing from the registry', () => {
    const rows = allRows().filter((r) => r.slug !== 'insulation').concat({ slug: 'gutters', name: 'Gutters', is_enabled: false });
    const r = checkCategoryConsistency(rows);
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/"insulation".*missing from the industries table/);
    expect(r.errors.join('\n')).toMatch(/"gutters" exists in the database but not in the application config/);
  });

  it('flags a prepared category that has been switched on in the database, and a name mismatch', () => {
    const rows = allRows().map((r) => (r.slug === 'windows_doors' ? { ...r, is_enabled: true } : r.slug === 'roofing' ? { ...r, name: 'Roofs' } : r));
    const r = checkCategoryConsistency(rows);
    expect(r.errors.join('\n')).toMatch(/"windows_doors" is prepared .* enabled in the database/);
    expect(r.errors.join('\n')).toMatch(/"roofing" is named "Roofs"/);
  });

  it('treats a live category switched off in the database as a note, not an error', () => {
    const r = checkCategoryConsistency(allRows().map((row) => (row.slug === 'roofing' ? { ...row, is_enabled: false } : row)));
    expect(r.ok).toBe(true);
    expect(r.notes.join('\n')).toMatch(/"roofing" is switched off/);
  });
});

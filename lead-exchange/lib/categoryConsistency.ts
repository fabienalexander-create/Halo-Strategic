import { CATEGORIES } from './industries';

export interface IndustryRow {
  slug: string;
  name: string;
  is_enabled: boolean;
}

export interface CategoryConsistencyReport {
  ok: boolean;
  // Mismatches that need fixing.
  errors: string[];
  // Allowed states worth knowing about (e.g. a live category switched off in the database).
  notes: string[];
}

/**
 * Compares the industries table with the central registry in lib/industries.ts. Used by the
 * migration tests and by GET /api/admin/categories against the production database.
 */
export function checkCategoryConsistency(rows: IndustryRow[]): CategoryConsistencyReport {
  const errors: string[] = [];
  const notes: string[] = [];
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  for (const c of CATEGORIES) {
    const row = bySlug.get(c.slug);
    if (!row) {
      errors.push(`Category "${c.slug}" is in the application config but missing from the industries table.`);
      continue;
    }
    if (row.name !== c.label) {
      errors.push(`Category "${c.slug}" is named "${row.name}" in the database but "${c.label}" in the application config.`);
    }
    if (c.status !== 'live' && row.is_enabled) {
      errors.push(`Category "${c.slug}" is ${c.status} in the application config but enabled in the database. It still cannot take enquiries, but the flag should be false until it goes live.`);
    }
    if (c.status === 'live' && !row.is_enabled) {
      notes.push(`Live category "${c.slug}" is switched off in the database, so it is not taking enquiries.`);
    }
  }
  for (const r of rows) {
    if (!CATEGORIES.some((c) => c.slug === r.slug)) {
      errors.push(`Industry "${r.slug}" exists in the database but not in the application config.`);
    }
  }
  return { ok: errors.length === 0, errors, notes };
}

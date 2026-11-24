import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';
import { CATEGORIES } from '../../../../lib/industries';
import { checkCategoryConsistency, IndustryRow } from '../../../../lib/categoryConsistency';

// Read-only: the central category registry alongside the live industries table, with any
// mismatches between them. Changes nothing.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;
  try {
    const rows = (await getDatabase().sql`SELECT slug, name, is_enabled FROM industries ORDER BY id`) as unknown as IndustryRow[];
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    return NextResponse.json({
      categories: CATEGORIES.map((c) => ({
        slug: c.slug, label: c.label, status: c.status, scope: c.scope ?? null,
        in_database: bySlug.has(c.slug), enabled_in_database: bySlug.get(c.slug)?.is_enabled ?? null,
      })),
      consistency: checkCategoryConsistency(rows),
    });
  } catch (err) {
    console.error('Category check failed', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'Failed to read categories.' }, { status: 500 });
  }
}

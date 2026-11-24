import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { checkCategoryConsistency, IndustryRow } from './categoryConsistency';
import { sqlFromClient } from './smsVerification';

// Applies every migration to a fresh local Postgres and proves the industries table matches the
// central registry, that the prepared/future categories are seeded disabled, and that intake
// refuses them end to end.
const adminUrl = process.env.TEST_PG_ADMIN_URL;
const isLocal = !!adminUrl && ['localhost', '127.0.0.1', '::1'].includes(new URL(adminUrl).hostname);
const require = createRequire(import.meta.url);
const dir = join(__dirname, '..', 'netlify', 'database', 'migrations');

describe.skipIf(!adminUrl)('category registry vs migrated database (real Postgres)', () => {
  const dbName = `lx_test_${Date.now()}_categories`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any, pgClient: any;

  beforeAll(async () => {
    if (!isLocal) throw new Error('TEST_PG_ADMIN_URL must point at localhost. Refusing to run.');
    const { Client } = require('pg');
    admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName}`);
    const url = new URL(adminUrl!);
    url.pathname = `/${dbName}`;
    pgClient = new Client({ connectionString: url.toString() });
    await pgClient.connect();
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
      await pgClient.query(readFileSync(join(dir, f), 'utf8'));
    }
  });

  afterAll(async () => {
    await pgClient?.end();
    await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin.end();
  });

  it('the migrated industries table matches the registry exactly', async () => {
    const rows = (await pgClient.query('SELECT slug, name, is_enabled FROM industries ORDER BY id')).rows as IndustryRow[];
    expect(checkCategoryConsistency(rows)).toEqual({ ok: true, errors: [], notes: [] });
  });

  it('seeds the new categories disabled and leaves the live ones enabled', async () => {
    const rows = (await pgClient.query('SELECT slug, is_enabled FROM industries')).rows as { slug: string; is_enabled: boolean }[];
    const enabled = Object.fromEntries(rows.map((r) => [r.slug, r.is_enabled]));
    expect(enabled).toMatchObject({
      spray_foam_removal: true, solar_battery: true, roofing: true,
      windows_doors: false, insulation: false, heat_pumps: false, kitchens: false, bathrooms: false,
    });
  });

  it('re-running the migration changes nothing', async () => {
    const before = (await pgClient.query('SELECT id, slug, name, is_enabled FROM industries ORDER BY id')).rows;
    await pgClient.query(readFileSync(join(dir, '20261124100000_prepared_categories.sql'), 'utf8'));
    const after = (await pgClient.query('SELECT id, slug, name, is_enabled FROM industries ORDER BY id')).rows;
    expect(after).toEqual(before);
  });

  it('the homeowner intake refuses a prepared category even when its database flag is switched on', async () => {
    await pgClient.query(`UPDATE industries SET is_enabled = true WHERE slug = 'windows_doors'`);
    const db = { sql: sqlFromClient(pgClient).sql, pool: { connect: async () => ({ query: (t: string, v?: unknown[]) => pgClient.query(t, v), release: () => {} }) } };
    vi.resetModules();
    vi.doMock('@netlify/database', () => ({ getDatabase: () => db }));
    process.env.META_HOMEOWNER_LEADS_WEBHOOK_SECRET = 'test-secret';
    const { POST } = await import('./../app/api/integrations/meta-homeowner-leads/route');
    const res = await POST(new NextRequest('https://example.com/api/integrations/meta-homeowner-leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-halo-integration-secret': 'test-secret' },
      body: JSON.stringify({ meta_lead_id: 'l:windows-test', mapped: { industry_slug: 'windows_doors', homeowner_name: 'Test', mobile: '07700900123', postcode: 'BL9 9AP' } }),
    }));
    expect(res.status).toBe(400);
    expect((await pgClient.query(`SELECT count(*)::int n FROM leads WHERE meta_lead_id = 'l:windows-test'`)).rows[0].n).toBe(0);
    await pgClient.query(`UPDATE industries SET is_enabled = false WHERE slug = 'windows_doors'`);
  });
});

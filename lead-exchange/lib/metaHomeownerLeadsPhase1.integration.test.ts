import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { sqlFromClient } from './smsVerification';

// Proves, against a real local Postgres, the Phase 1 behaviour that's genuinely database-shaped
// rather than pure application logic: the buyer-coverage query actually used for the
// outside-service-area classification, that a duplicate delivery's rolled-back consent_records
// row never survives, and that a successful ingestion really leaves a linked consent_records row
// and a lead_sheet_syncs row behind -- not just what the mocked unit test asserts was attempted.
// secretMatches (lib/smsWebhookAuth.ts) is real here, not mocked -- it's a pure HMAC-safe string
// compare with no external dependency, so there's nothing to isolate it from.
const adminUrl = process.env.TEST_PG_ADMIN_URL;
const isLocal = !!adminUrl && ['localhost', '127.0.0.1', '::1'].includes(new URL(adminUrl).hostname);
const require = createRequire(import.meta.url);
const dir = join(__dirname, '..', 'netlify', 'database', 'migrations');

describe.skipIf(!adminUrl)('Meta homeowner leads Phase 1 (real Postgres)', () => {
  const dbName = `lx_test_${Date.now()}_metaphase1`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any, pgClient: any;
  let industryId: number;
  let db: { sql: ReturnType<typeof sqlFromClient>['sql']; pool: { connect: () => Promise<{ query: (t: string, v?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>; release: () => void }> } };

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

    await pgClient.query(`INSERT INTO industries (slug, name, is_enabled) VALUES ('spray_foam_removal','Spray Foam Removal',true) ON CONFLICT (slug) DO NOTHING`);
    industryId = (await pgClient.query(`SELECT id FROM industries WHERE slug = 'spray_foam_removal'`)).rows[0].id;

    db = {
      sql: sqlFromClient(pgClient).sql,
      pool: { connect: async () => ({ query: (t: string, v?: unknown[]) => pgClient.query(t, v), release: () => {} }) },
    };
  });

  afterAll(async () => {
    await pgClient?.end();
    await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin.end();
  });

  beforeEach(() => {
    process.env.META_HOMEOWNER_LEADS_WEBHOOK_SECRET = 'test-secret';
  });

  async function post(mapped: Record<string, unknown>, metaLeadId: string) {
    vi.resetModules();
    vi.doMock('@netlify/database', () => ({ getDatabase: () => db }));
    const { POST } = await import('./../app/api/integrations/meta-homeowner-leads/route');
    const req = new NextRequest('https://example.com/api/integrations/meta-homeowner-leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-halo-integration-secret': 'test-secret' },
      body: JSON.stringify({ meta_lead_id: metaLeadId, mapped }),
    });
    return POST(req);
  }

  const BASE_MAPPED = {
    industry_slug: 'spray_foam_removal',
    homeowner_name: 'Real Postgres Homeowner',
    mobile: '+447700900000',
    postcode: 'N15 5DF',
    property_type: 'Flat',
    owns_property: true,
    reason_for_enquiry: 'Selling the property',
    timeframe: 'Within 3 months',
    preferred_contact_method: 'Phone',
    consent_contact: true,
  };

  it('with no ACTIVE buyer at all, flags outside_service_area and still saves the lead', async () => {
    const res = await post({ ...BASE_MAPPED }, 'l:phase1-no-buyers');
    const data = await res.json();
    expect(res.status).toBe(201);

    const lead = (await pgClient.query(`SELECT qualification_answers, consent_record_id FROM leads WHERE id = $1`, [data.lead_id])).rows[0];
    expect(lead.qualification_answers.needs_manual_review).toBe(true);
    expect(lead.qualification_answers.review_reasons).toContain('outside_service_area');
    expect(lead.consent_record_id).not.toBeNull();

    const consent = (await pgClient.query(`SELECT lead_id, named_recipient_or_category FROM consent_records WHERE id = $1`, [lead.consent_record_id])).rows[0];
    expect(consent.lead_id).toBe(data.lead_id);
    expect(consent.named_recipient_or_category).toContain('Spray Foam Removal');

    const sync = (await pgClient.query(`SELECT status FROM lead_sheet_syncs WHERE lead_id = $1`, [data.lead_id])).rows;
    expect(sync).toHaveLength(1); // present regardless of Google Sheets being configured in this test env
  });

  it('a real ACTIVE buyer covering the postcode removes the outside_service_area flag', async () => {
    await pgClient.query(`
      INSERT INTO buyers (company_name, contact_name, contact_email, telephone, industry_id, application_status,
                           agreed_price_per_lead, coverage_type, onboarding_call_completed_at, onboarding_call_conducted_by, application_reference)
      VALUES ('Covers N15', 'Covers N15', 'covers@example.com', '07700900001', $1, 'ACTIVE', 65, 'national', now(), 'admin@halostrategic.com', $2)
    `, [industryId, `HLX-BYR-TEST-${Date.now()}`]);

    const res = await post({ ...BASE_MAPPED }, 'l:phase1-with-buyer');
    const data = await res.json();
    expect(res.status).toBe(201);

    const lead = (await pgClient.query(`SELECT qualification_answers FROM leads WHERE id = $1`, [data.lead_id])).rows[0];
    expect(lead.qualification_answers.review_reasons).not.toContain('outside_service_area');
  });

  it('a retried delivery rolls back cleanly -- no orphaned consent_records row, no second lead', async () => {
    const first = await post({ ...BASE_MAPPED }, 'l:phase1-retry');
    const firstData = await first.json();
    expect(first.status).toBe(201);

    const retry = await post({ ...BASE_MAPPED, homeowner_name: 'Different Name On Retry' }, 'l:phase1-retry');
    const retryData = await retry.json();
    expect(retry.status).toBe(200);
    expect(retryData.duplicate).toBe(true);
    expect(retryData.lead_id).toBe(firstData.lead_id);

    const leadCount = (await pgClient.query(`SELECT count(*)::int n FROM leads WHERE meta_lead_id = 'l:phase1-retry'`)).rows[0].n;
    expect(leadCount).toBe(1);

    // The retry's own consent_records insert must have been rolled back, not left dangling.
    const orphanedConsent = (await pgClient.query(`SELECT count(*)::int n FROM consent_records WHERE lead_id IS NULL AND source = 'meta_instant_form'`)).rows[0].n;
    expect(orphanedConsent).toBe(0);
  });

  it('rejects consent_contact: false before touching the database', async () => {
    const res = await post({ ...BASE_MAPPED, consent_contact: false }, 'l:phase1-no-consent');
    expect(res.status).toBe(400);
    const count = (await pgClient.query(`SELECT count(*)::int n FROM leads WHERE meta_lead_id = 'l:phase1-no-consent'`)).rows[0].n;
    expect(count).toBe(0);
  });
});

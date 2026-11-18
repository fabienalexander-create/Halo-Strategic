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
  let admin: any, pgClient: any, pgPool: any;
  let industryId: number;
  let db: { sql: ReturnType<typeof sqlFromClient>['sql']; pool: { connect: () => Promise<{ query: (t: string, v?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>; release: () => void }> } };

  beforeAll(async () => {
    if (!isLocal) throw new Error('TEST_PG_ADMIN_URL must point at localhost. Refusing to run.');
    const { Client, Pool } = require('pg');
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

    // A real pg.Pool, not a wrapper around the single pgClient above -- this is what makes the
    // concurrent-completion test below genuine: two requests that call db.pool.connect() at the
    // same time must get two independent sessions, each with its own transaction, exactly as
    // Netlify's real @netlify/database does. Sharing one connection across "concurrent" requests
    // would make one request's ROLLBACK silently undo the other's still-in-flight, uncommitted
    // work -- a false failure that has nothing to do with this codebase's own locking logic.
    pgPool = new Pool({ connectionString: url.toString(), max: 5 });

    db = {
      sql: sqlFromClient(pgClient).sql,
      pool: { connect: async () => { const c = await pgPool.connect(); return { query: (t: string, v?: unknown[]) => c.query(t, v), release: () => c.release() }; } },
    };
  });

  afterAll(async () => {
    await pgPool?.end();
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

  // Fabien, 2026-11-18 (incomplete-intake change): consent_contact: false (or missing) is no
  // longer rejected -- the live Instant Form doesn't ask for consent at all, so this must be
  // accepted as an incomplete lead, never with consent invented on its behalf.
  it('accepts consent_contact: false as an incomplete lead, with NO consent_records row created', async () => {
    const res = await post({ ...BASE_MAPPED, consent_contact: false }, 'l:phase1-no-consent');
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.awaiting_qualification).toBe(true);
    expect(typeof data.follow_up_url).toBe('string');

    const lead = (await pgClient.query(
      `SELECT consent_record_id, status, qualification_answers, follow_up_token_hash, follow_up_token_expires_at, follow_up_token_used_at
       FROM leads WHERE meta_lead_id = 'l:phase1-no-consent'`
    )).rows[0];
    expect(lead.consent_record_id).toBeNull();
    expect(lead.status).toBe('QUALIFICATION_PENDING');
    expect(lead.qualification_answers.needs_manual_review).toBe(true);
    expect(lead.qualification_answers.review_reasons).toContain('awaiting_qualification');
    expect(lead.follow_up_token_hash).not.toBeNull();
    expect(lead.follow_up_token_expires_at).not.toBeNull();
    expect(lead.follow_up_token_used_at).toBeNull();

    // No consent_records row exists for this lead at all -- not even an unlinked one.
    const anyConsentForThisLead = (await pgClient.query(
      `SELECT count(*)::int n FROM consent_records c JOIN leads l ON l.consent_record_id = c.id WHERE l.meta_lead_id = 'l:phase1-no-consent'`
    )).rows[0].n;
    expect(anyConsentForThisLead).toBe(0);
  });

  it('a submission missing all qualification questions is flagged awaiting_qualification, hard-required fields still enforced', async () => {
    const res = await post(
      { industry_slug: 'spray_foam_removal', homeowner_name: 'Five Question Homeowner', mobile: '+447700900111', postcode: 'N15 5DF', owns_property: true },
      'l:phase1-five-question'
    );
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.awaiting_qualification).toBe(true);

    const missingName = await post({ ...BASE_MAPPED, homeowner_name: undefined }, 'l:phase1-missing-name');
    expect(missingName.status).toBe(400);
  });

  it('the full follow-up journey: an incomplete Meta lead is completed on the website, ends at NEW, and only then becomes allocatable', async () => {
    const { POST: completePOST } = await import('../app/api/homeowner-enquiries/complete/route');

    const ingest = await post({ ...BASE_MAPPED, consent_contact: false, reason_for_enquiry: undefined, timeframe: undefined }, 'l:phase1-followup');
    const ingestData = await ingest.json();
    expect(ingest.status).toBe(201);
    const rawToken = new URL(ingestData.follow_up_url).searchParams.get('token');
    expect(rawToken).toBeTruthy();

    // Allocation must be refused while the lead is still QUALIFICATION_PENDING. Exercised here
    // directly against the real leads row's status (the allocate route itself is covered by its
    // own mocked unit tests) -- this is the one commercial safeguard that must hold end to end.
    const beforeCompletion = (await pgClient.query(`SELECT status FROM leads WHERE id = $1`, [ingestData.lead_id])).rows[0];
    expect(beforeCompletion.status).toBe('QUALIFICATION_PENDING');

    const completeReq = new NextRequest('https://example.com/api/homeowner-enquiries/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.9' },
      body: JSON.stringify({
        token: rawToken,
        reason_for_enquiry: 'Selling the property',
        timeframe: 'Within 3 months',
        preferred_contact_method: 'Phone',
        consent_contact: true,
        consent_share_buyer: true,
        privacy_consent: true,
      }),
    });
    const complete = await completePOST(completeReq);
    const completeData = await complete.json();
    expect(complete.status).toBe(200);
    expect(completeData.lead_id).toBe(ingestData.lead_id);
    expect(completeData.status).toBe('NEW');

    const after = (await pgClient.query(
      `SELECT status, consent_record_id, qualification_answers, follow_up_token_used_at FROM leads WHERE id = $1`,
      [ingestData.lead_id]
    )).rows[0];
    expect(after.status).toBe('NEW');
    expect(after.consent_record_id).not.toBeNull();
    expect(after.qualification_answers.awaiting_qualification).toBe(false);
    expect(after.qualification_answers.reason_for_enquiry).toBe('Selling the property');
    expect(after.follow_up_token_used_at).not.toBeNull();

    const consent = (await pgClient.query(`SELECT lead_id, source FROM consent_records WHERE id = $1`, [after.consent_record_id])).rows[0];
    expect(consent.lead_id).toBe(ingestData.lead_id);
    expect(consent.source).toBe('spray_foam_removal_homeowner_followup');

    // The token is single-use: trying to complete again with the same raw token must now fail.
    const secondAttempt = await completePOST(new NextRequest('https://example.com/api/homeowner-enquiries/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '198.51.100.10' },
      body: JSON.stringify({
        token: rawToken, reason_for_enquiry: 'Selling the property', timeframe: 'Within 3 months',
        preferred_contact_method: 'Phone', consent_contact: true, consent_share_buyer: true, privacy_consent: true,
      }),
    }));
    expect(secondAttempt.status).toBe(410);
  });

  it('concurrent completion attempts for the same token: only one can ever succeed', async () => {
    const { POST: completePOST } = await import('../app/api/homeowner-enquiries/complete/route');

    const ingest = await post({ ...BASE_MAPPED, consent_contact: false }, 'l:phase1-concurrent');
    const ingestData = await ingest.json();
    const rawToken = new URL(ingestData.follow_up_url).searchParams.get('token');

    const makeReq = (ip: string) => new NextRequest('https://example.com/api/homeowner-enquiries/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify({
        token: rawToken, reason_for_enquiry: 'Selling the property', timeframe: 'Within 3 months',
        preferred_contact_method: 'Phone', consent_contact: true, consent_share_buyer: true, privacy_consent: true,
      }),
    });

    const [first, second] = await Promise.all([
      completePOST(makeReq('198.51.100.20')),
      completePOST(makeReq('198.51.100.21')),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 410]); // exactly one winner, one loser -- never two winners
  });
});

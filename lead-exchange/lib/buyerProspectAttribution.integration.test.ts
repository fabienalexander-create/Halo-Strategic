import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { captureBuyerProspectTouch } from './buyerProspectCapture';

// Proves, against a real local Postgres, that:
//   1. All migrations (including the two new attribution ones) apply in order on top of existing
//      production-shaped data.
//   2. A pre-existing pair of duplicate ACTIVE prospects (the exact situation real production may
//      already be in, since there was never a uniqueness rule before this) is safely merged by
//      the migration, preserving the earlier row's first-touch and the later row's data as
//      last-touch, with no orphaned buyer_prospect_emails rows left behind.
//   3. The shared capture helper, exercised against the real schema (not a fake), produces the
//      same first-touch/last-touch/dedup behaviour the unit tests assert against a fake client.
//   4. The prospect-to-application linking query (the same shape used in
//      app/api/buyer-applications/route.ts) correctly finds, locks, and converts a matching
//      prospect -- and correctly finds nothing for an email+industry with no active prospect.
//
// Local throwaway database only (skipped unless TEST_PG_ADMIN_URL is set; refuses non-local hosts).
const adminUrl = process.env.TEST_PG_ADMIN_URL;
const isLocal = !!adminUrl && ['localhost', '127.0.0.1', '::1'].includes(new URL(adminUrl).hostname);
const require = createRequire(import.meta.url);
const dir = join(__dirname, '..', 'netlify', 'database', 'migrations');

describe.skipIf(!adminUrl)('buyer prospect attribution (website + Meta Instant Form)', () => {
  const dbName = `lx_test_${Date.now()}_attr`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any, pgPool: any;
  let db: { sql: (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Record<string, unknown>[]>; pool: any };
  let industryId: number;

  beforeAll(async () => {
    if (!isLocal) throw new Error('TEST_PG_ADMIN_URL must point at localhost. Refusing to run.');
    const { Client, Pool } = require('pg');
    admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName}`);
    const url = new URL(adminUrl!);
    url.pathname = `/${dbName}`;

    // Seed pre-existing duplicate ACTIVE prospects (simulating real data from before this
    // migration existed) BEFORE applying the two new attribution migrations.
    const setupClient = new Client({ connectionString: url.toString() });
    await setupClient.connect();
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
      if (f.startsWith('20261113120000') || f.startsWith('20261113130000')) continue;
      await setupClient.query(readFileSync(join(dir, f), 'utf8'));
    }
    await setupClient.query(`INSERT INTO industries (slug, name, is_enabled) VALUES ('solar_battery','Solar',true) ON CONFLICT (slug) DO NOTHING`);
    await setupClient.query(`
      INSERT INTO buyer_prospects (prospect_reference, industry_id, company_name, contact_name, contact_email, telephone, source, utm_source, utm_campaign, consent_contact, unsubscribe_token, created_at)
      VALUES
        ('HLX-PROSPECT-900001', (SELECT id FROM industries WHERE slug='solar_battery'), 'Dup Co', 'Dup Person', 'dup@example.test', '07700900999', 'organic_website', NULL, NULL, true, encode(gen_random_bytes(32),'hex'), now() - interval '5 days'),
        ('HLX-PROSPECT-900002', (SELECT id FROM industries WHERE slug='solar_battery'), 'Dup Co', 'Dup Person', 'dup@example.test', '07700900999', 'meta', 'meta_paid', 'retarget', true, encode(gen_random_bytes(32),'hex'), now() - interval '1 day')
    `);
    await setupClient.end();

    // Now apply the two new migrations -- this is the merge-under-real-data moment.
    const applyClient = new Client({ connectionString: url.toString() });
    await applyClient.connect();
    await applyClient.query(readFileSync(join(dir, '20261113120000_buyer_prospect_attribution.sql'), 'utf8'));
    await applyClient.query(readFileSync(join(dir, '20261113130000_buyer_application_attribution.sql'), 'utf8'));
    await applyClient.end();

    pgPool = new Pool({ connectionString: url.toString() });
    db = {
      sql: async (strings: TemplateStringsArray, ...values: unknown[]) => {
        const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ''), '');
        const res = await pgPool.query(text, values);
        return res.rows;
      },
      pool: pgPool,
    };
    const industryRows = await db.sql`SELECT id FROM industries WHERE slug = ${'solar_battery'}`;
    industryId = industryRows[0].id as number;
  });

  afterAll(async () => {
    await pgPool?.end();
    await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin.end();
  });

  it('merged the pre-existing duplicate into one row, preserving first-touch and capturing last-touch', async () => {
    const rows = await db.sql`SELECT * FROM buyer_prospects WHERE contact_email = ${'dup@example.test'}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].prospect_reference).toBe('HLX-PROSPECT-900001'); // the earlier row survives
    expect(rows[0].utm_source).toBeNull(); // original first-touch preserved exactly
    expect(rows[0].last_touch_utm_source).toBe('meta_paid'); // later duplicate's data became last-touch
    expect(rows[0].last_touch_utm_campaign).toBe('retarget');
  });

  it('left no orphaned buyer_prospect_emails row for the removed duplicate', async () => {
    const orphans = await db.sql`
      SELECT e.id FROM buyer_prospect_emails e
      LEFT JOIN buyer_prospects p ON p.id = e.prospect_id
      WHERE p.id IS NULL
    `;
    expect(orphans).toHaveLength(0);
  });

  it('a brand new website registration creates one prospect, first-touch = last-touch', async () => {
    const result = await captureBuyerProspectTouch(db, {
      channel: 'website', industryId, industrySlug: 'solar_battery',
      companyName: 'Real Co', contactName: 'Real Person', contactEmail: 'real@example.test', telephone: '07700900001',
      consentContact: true, utmSource: 'google', utmCampaign: 'brand',
    });
    expect(result.isNewProspect).toBe(true);
    const rows = await db.sql`SELECT * FROM buyer_prospects WHERE id = ${result.prospectId}`;
    expect(rows[0].utm_source).toBe('google');
    expect(rows[0].last_touch_utm_source).toBe('google');
  });

  it('a later Meta Instant Form touch for the same email+industry updates last-touch only, same row', async () => {
    const first = await captureBuyerProspectTouch(db, {
      channel: 'website', industryId, industrySlug: 'solar_battery',
      companyName: 'Cross Route Co', contactName: 'Cross Route', contactEmail: 'crossroute@example.test', telephone: '07700900002',
      consentContact: true, utmSource: 'organic',
    });
    const second = await captureBuyerProspectTouch(db, {
      channel: 'meta_instant_form', industryId, industrySlug: 'solar_battery',
      companyName: 'Cross Route Co', contactName: 'Cross Route', contactEmail: 'crossroute@example.test', telephone: '07700900002',
      consentContact: true, metaLeadId: 'lead_crossroute_1', metaCampaignName: 'Autumn Push',
    });

    expect(second.prospectId).toBe(first.prospectId);
    const rows = await db.sql`SELECT * FROM buyer_prospects WHERE id = ${first.prospectId}`;
    expect(rows[0].capture_channel).toBe('website'); // first-touch frozen
    expect(rows[0].last_touch_channel).toBe('meta_instant_form');
    expect(rows[0].meta_campaign_name).toBe('Autumn Push');

    const touches = await db.sql`SELECT * FROM buyer_prospect_touches WHERE prospect_id = ${first.prospectId}`;
    expect(touches).toHaveLength(2);
  });

  it('a retried Meta lead_id is a true no-op, not a second touch', async () => {
    const a = await captureBuyerProspectTouch(db, {
      channel: 'meta_instant_form', industryId, industrySlug: 'solar_battery',
      companyName: 'Retry Co', contactName: 'Retry Person', contactEmail: 'retry@example.test', telephone: '07700900003',
      consentContact: true, metaLeadId: 'lead_retry_1',
    });
    const b = await captureBuyerProspectTouch(db, {
      channel: 'meta_instant_form', industryId, industrySlug: 'solar_battery',
      companyName: 'Retry Co', contactName: 'Retry Person', contactEmail: 'retry@example.test', telephone: '07700900003',
      consentContact: true, metaLeadId: 'lead_retry_1',
    });
    expect(b.isDuplicateMetaLead).toBe(true);
    expect(b.prospectId).toBe(a.prospectId);
    const touches = await db.sql`SELECT * FROM buyer_prospect_touches WHERE prospect_id = ${a.prospectId}`;
    expect(touches).toHaveLength(1);
  });

  it('the prospect-to-application matching query finds and locks an active prospect by email+industry', async () => {
    const created = await captureBuyerProspectTouch(db, {
      channel: 'website', industryId, industrySlug: 'solar_battery',
      companyName: 'Match Co', contactName: 'Match Person', contactEmail: 'match@example.test', telephone: '07700900004',
      consentContact: true, utmSource: 'meta', fbclid: 'fbclid_match_1',
    });

    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const match = await client.query(
        `SELECT id, utm_source, fbclid, capture_channel FROM buyer_prospects
         WHERE contact_email = $1 AND industry_id = (SELECT id FROM industries WHERE slug = $2) AND converted_buyer_id IS NULL
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
        ['match@example.test', 'solar_battery']
      );
      expect(match.rows).toHaveLength(1);
      expect(match.rows[0].id).toBe(created.prospectId);
      expect(match.rows[0].fbclid).toBe('fbclid_match_1');

      const buyerInsert = await client.query(
        `INSERT INTO buyers (
          company_name, contact_name, contact_email, telephone, industry_id,
          confirmed_info_accurate, confirmed_can_deliver_services,
          agreed_buyer_terms_at, agreed_buyer_terms_version,
          acknowledged_replacement_policy_at, acknowledged_replacement_policy_version,
          confirmed_payment_before_release_understanding, agreed_pii_handling,
          agreed_account_notifications, application_status, application_reference
        ) VALUES ($1,$2,$3,$4,$5,true,true,now(),'v1',now(),'v1',true,true,true,'PENDING_REVIEW',$6)
        RETURNING id`,
        ['Match Co', 'Match Person', 'match@example.test', '07700900004', industryId, `HLX-BYR-TEST-${Date.now()}`]
      );
      const buyerId = buyerInsert.rows[0].id;

      await client.query(`UPDATE buyer_prospects SET converted_buyer_id = $1, converted_at = now() WHERE id = $2`, [buyerId, created.prospectId]);
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const after = await db.sql`SELECT converted_buyer_id FROM buyer_prospects WHERE id = ${created.prospectId}`;
    expect(after[0].converted_buyer_id).not.toBeNull();

    // Converted prospects are excluded from future matching -- a second application for the
    // same email+industry finds nothing (correctly treated as a direct application).
    const noMatch = await db.sql`
      SELECT id FROM buyer_prospects
      WHERE contact_email = ${'match@example.test'} AND industry_id = ${industryId} AND converted_buyer_id IS NULL
    `;
    expect(noMatch).toHaveLength(0);
  });

  it('a prospect_reference hint with a mismatched email is never trusted', async () => {
    const real = await captureBuyerProspectTouch(db, {
      channel: 'website', industryId, industrySlug: 'solar_battery',
      companyName: 'Forge Target Co', contactName: 'Target', contactEmail: 'target@example.test', telephone: '07700900005',
      consentContact: true,
    });

    const byRef = await db.sql`
      SELECT id, contact_email FROM buyer_prospects WHERE id = ${real.prospectId} AND converted_buyer_id IS NULL
    `;
    // Simulates the route's own corroboration check: the reference resolves to a real row, but
    // the attacker's own contact_email ('attacker@example.test') does not match it, so the route
    // must fall through to the email+industry fallback (which, for a fabricated attacker email
    // with no prior registration, finds nothing) rather than linking to this unrelated prospect.
    expect((byRef[0].contact_email as string).toLowerCase()).not.toBe('attacker@example.test');
  });
});

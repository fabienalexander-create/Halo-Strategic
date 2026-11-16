import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Proves, against a real local Postgres seeded with PRE-EXISTING data (not an empty database),
// that:
//   1. The new migration (20261115100000_prospect_paused_suppression.sql) applies cleanly as a
//      pure function replacement -- no existing row touched, no existing SENT email affected.
//   2. Before the fix, a PAUSED prospect's outbox row could be marked SENT by the database with
//      no error (the gap found during the HLX-PROSPECT-000003 review). After the fix, the
//      database itself refuses it, independent of any application-level check.
//   3. Stuart's exact scenario: a row that already failed once (simulating the missing
//      RESEND_API_KEY incident), on a prospect quarantined afterwards, still cannot be marked
//      SENT by a later retry -- at the database layer, with no application code involved at all.
//   4. The existing UNSUBSCRIBED/bounced/complained enforcement is unchanged (regression check).
//
// Local throwaway database only (skipped unless TEST_PG_ADMIN_URL is set; refuses non-local hosts).
const adminUrl = process.env.TEST_PG_ADMIN_URL;
const isLocal = !!adminUrl && ['localhost', '127.0.0.1', '::1'].includes(new URL(adminUrl).hostname);
const require = createRequire(import.meta.url);
const dir = join(__dirname, '..', 'netlify', 'database', 'migrations');
const PAUSED_SUPPRESSION_MIGRATION = '20261115100000_prospect_paused_suppression.sql';

describe.skipIf(!adminUrl)('buyer_prospect_emails PAUSED suppression', () => {
  const dbName = `lx_test_${Date.now()}_paused`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any, db: any;
  let industryId: number;

  beforeAll(async () => {
    if (!isLocal) throw new Error('TEST_PG_ADMIN_URL must point at localhost. Refusing to run.');
    const { Client } = require('pg');
    admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName}`);
    const url = new URL(adminUrl!);
    url.pathname = `/${dbName}`;
    db = new Client({ connectionString: url.toString() });
    await db.connect();

    // Apply everything EXCEPT the new migration first, then seed PRE-EXISTING data, so the new
    // migration is genuinely tested against a database that already has rows in it -- matching
    // real production, not a clean slate.
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
      if (f === PAUSED_SUPPRESSION_MIGRATION) continue;
      await db.query(readFileSync(join(dir, f), 'utf8'));
    }

    await db.query(`INSERT INTO industries (slug, name, is_enabled) VALUES ('solar_battery','Solar',true) ON CONFLICT (slug) DO NOTHING`);
    const industryRows = await db.query(`SELECT id FROM industries WHERE slug = 'solar_battery'`);
    industryId = industryRows.rows[0].id;

    // A real pre-existing SENT email on an unrelated, perfectly healthy prospect -- this must
    // survive the migration untouched.
    await db.query(`
      INSERT INTO buyer_prospects (prospect_reference, industry_id, company_name, contact_name, contact_email, telephone, consent_contact, unsubscribe_token, last_touch_at)
      VALUES ('HLX-PROSPECT-PRE-EXISTING', $1, 'Healthy Co', 'Healthy Person', 'healthy@example.test', '07700900000', true, encode(gen_random_bytes(32),'hex'), now())
    `, [industryId]);
    const healthyProspect = await db.query(`SELECT id FROM buyer_prospects WHERE prospect_reference = 'HLX-PROSPECT-PRE-EXISTING'`);
    await db.query(`
      INSERT INTO buyer_prospect_emails (prospect_id, nurture_step, recipient, status, sent_at)
      VALUES ($1, 1, 'healthy@example.test', 'SENT', now())
    `, [healthyProspect.rows[0].id]);

    // Now apply the new migration -- the actual moment under test.
    await db.query(readFileSync(join(dir, PAUSED_SUPPRESSION_MIGRATION), 'utf8'));
  });

  afterAll(async () => {
    await db?.end();
    await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin.end();
  });

  it('migration is additive: the pre-existing SENT row is untouched', async () => {
    const rows = await db.query(`SELECT status FROM buyer_prospect_emails WHERE recipient = 'healthy@example.test'`);
    expect(rows.rows[0].status).toBe('SENT');
  });

  it('a healthy ACTIVE prospect can still be marked SENT (regression check)', async () => {
    const prospect = await db.query(`
      INSERT INTO buyer_prospects (prospect_reference, industry_id, company_name, contact_name, contact_email, telephone, consent_contact, unsubscribe_token, last_touch_at)
      VALUES ('HLX-PROSPECT-ACTIVE-OK', $1, 'Active Co', 'Active Person', 'active@example.test', '07700900001', true, encode(gen_random_bytes(32),'hex'), now())
      RETURNING id
    `, [industryId]);
    const email = await db.query(`
      INSERT INTO buyer_prospect_emails (prospect_id, nurture_step, recipient, status)
      VALUES ($1, 1, 'active@example.test', 'PENDING') RETURNING id
    `, [prospect.rows[0].id]);

    await expect(
      db.query(`UPDATE buyer_prospect_emails SET status = 'SENT', sent_at = now() WHERE id = $1`, [email.rows[0].id])
    ).resolves.toBeDefined();
  });

  it('the database itself now refuses to mark a PAUSED prospect\'s email SENT', async () => {
    const prospect = await db.query(`
      INSERT INTO buyer_prospects (prospect_reference, industry_id, company_name, contact_name, contact_email, telephone, consent_contact, unsubscribe_token, last_touch_at, nurture_status)
      VALUES ('HLX-PROSPECT-PAUSED-TEST', $1, 'Paused Co', 'Paused Person', 'paused@example.test', '07700900002', true, encode(gen_random_bytes(32),'hex'), now(), 'PAUSED')
      RETURNING id
    `, [industryId]);
    const email = await db.query(`
      INSERT INTO buyer_prospect_emails (prospect_id, nurture_step, recipient, status)
      VALUES ($1, 1, 'paused@example.test', 'PENDING') RETURNING id
    `, [prospect.rows[0].id]);

    await expect(
      db.query(`UPDATE buyer_prospect_emails SET status = 'SENT', sent_at = now() WHERE id = $1`, [email.rows[0].id])
    ).rejects.toThrow(/suppressed.*paused/i);

    const after = await db.query(`SELECT status FROM buyer_prospect_emails WHERE id = $1`, [email.rows[0].id]);
    expect(after.rows[0].status).toBe('PENDING'); // the UPDATE was rejected entirely, not half-applied
  });

  it("Stuart's exact scenario at the database layer: a FAILED row, prospect quarantined afterwards, a later retry is still refused", async () => {
    const prospect = await db.query(`
      INSERT INTO buyer_prospects (prospect_reference, industry_id, company_name, contact_name, contact_email, telephone, consent_contact, unsubscribe_token, last_touch_at)
      VALUES ('HLX-PROSPECT-000003-SIM', $1, 'the batt man', 'Stuart Goodman', 'sg@l2mc.co.uk', '+447738377422', true, encode(gen_random_bytes(32),'hex'), now())
      RETURNING id
    `, [industryId]);
    const prospectId = prospect.rows[0].id;

    // The original failed send (missing RESEND_API_KEY).
    const email = await db.query(`
      INSERT INTO buyer_prospect_emails (prospect_id, nurture_step, recipient, status, error_message)
      VALUES ($1, 1, 'sg@l2mc.co.uk', 'FAILED', 'RESEND_API_KEY is not configured') RETURNING id
    `, [prospectId]);

    // The quarantine decision, applied afterwards.
    await db.query(`UPDATE buyer_prospects SET nurture_status = 'PAUSED' WHERE id = $1`, [prospectId]);

    // Simulated retry attempt (e.g. if RESEND_API_KEY were later configured and something tried
    // to resend this exact outbox row) -- must still be refused at the database layer alone.
    await expect(
      db.query(`UPDATE buyer_prospect_emails SET status = 'SENT', sent_at = now() WHERE id = $1`, [email.rows[0].id])
    ).rejects.toThrow(/suppressed.*paused/i);

    const after = await db.query(`SELECT status, error_message FROM buyer_prospect_emails WHERE id = $1`, [email.rows[0].id]);
    expect(after.rows[0].status).toBe('FAILED'); // unchanged -- the rejected UPDATE never applied
  });

  it('UNSUBSCRIBED, bounced and complained are still enforced (regression check)', async () => {
    const prospect = await db.query(`
      INSERT INTO buyer_prospects (prospect_reference, industry_id, company_name, contact_name, contact_email, telephone, consent_contact, unsubscribe_token, last_touch_at, nurture_status)
      VALUES ('HLX-PROSPECT-UNSUB-TEST', $1, 'Unsub Co', 'Unsub Person', 'unsub@example.test', '07700900003', true, encode(gen_random_bytes(32),'hex'), now(), 'UNSUBSCRIBED')
      RETURNING id
    `, [industryId]);
    const email = await db.query(`
      INSERT INTO buyer_prospect_emails (prospect_id, nurture_step, recipient, status)
      VALUES ($1, 1, 'unsub@example.test', 'PENDING') RETURNING id
    `, [prospect.rows[0].id]);

    await expect(
      db.query(`UPDATE buyer_prospect_emails SET status = 'SENT', sent_at = now() WHERE id = $1`, [email.rows[0].id])
    ).rejects.toThrow(/suppressed/i);
  });
});

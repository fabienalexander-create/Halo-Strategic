import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';

// Real-Postgres tests for (1) the append-only audit_log protection and (2) the actual SQL of the
// onboarding-call correction route (the unit tests mock the database, so they cannot prove the SQL).
// Skipped unless TEST_PG_ADMIN_URL is set; refuses any non-local host; uses a throwaway database.
//   TEST_PG_ADMIN_URL=postgres://postgres@127.0.0.1:5432/postgres npx vitest run lib/auditAndCorrection
const adminUrl = process.env.TEST_PG_ADMIN_URL;
const isLocal = !!adminUrl && ['localhost', '127.0.0.1', '::1'].includes(new URL(adminUrl).hostname);
const require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const holder: { db: any } = ((globalThis as any).__lxHolder = (globalThis as any).__lxHolder ?? { db: null });

vi.mock('@netlify/database', () => ({
  getDatabase: () => ({
    sql: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      let text = '';
      strings.forEach((s, i) => { text += s + (i < values.length ? `$${i + 1}` : ''); });
      return (await holder.db.query(text, values)).rows;
    },
  }),
}));
vi.mock('./requireAdmin', async () => ({
  requireOwner: async () => ({ session: { email: 'owner@example.com', role: 'owner' } }),
  requireAdmin: async () => ({ session: { email: 'owner@example.com', role: 'owner' } }),
}));

describe.skipIf(!adminUrl)('audit_log append-only and call correction (real Postgres)', () => {
  const dbName = `lx_test_${Date.now()}_b`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any;

  beforeAll(async () => {
    if (!isLocal) throw new Error('TEST_PG_ADMIN_URL must point at localhost. Refusing to run.');
    const { Client } = require('pg');
    admin = new Client({ connectionString: adminUrl });
    await admin.connect();
    await admin.query(`CREATE DATABASE ${dbName}`);
    const url = new URL(adminUrl!);
    url.pathname = `/${dbName}`;
    holder.db = new Client({ connectionString: url.toString() });
    await holder.db.connect();
    const dir = join(__dirname, '..', 'netlify', 'database', 'migrations');
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.sql')).sort()) {
      await holder.db.query(readFileSync(join(dir, f), 'utf8'));
    }
    await holder.db.query(`INSERT INTO industries (slug, name, is_enabled) VALUES ('solar_battery','Solar',true) ON CONFLICT (slug) DO NOTHING`);
  });

  afterAll(async () => {
    if (holder.db) await holder.db.end();
    if (admin) {
      await admin.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
      await admin.end();
    }
  });

  const q = (text: string, v: unknown[] = []) => holder.db.query(text, v);

  describe('audit_log append-only', () => {
    it('still allows inserts and reads', async () => {
      await q(`INSERT INTO audit_log (actor, action, entity_type, entity_id, new_state) VALUES ('t','X','test',999999,'{"a":1}')`);
      const r = await q(`SELECT count(*)::int AS n FROM audit_log WHERE actor = 't'`);
      expect(r.rows[0].n).toBe(1);
    });
    it('refuses UPDATE', async () => {
      await expect(q(`UPDATE audit_log SET action = 'Y' WHERE actor = 't'`)).rejects.toThrow(/append-only/);
    });
    it('refuses DELETE', async () => {
      await expect(q(`DELETE FROM audit_log WHERE actor = 't'`)).rejects.toThrow(/append-only/);
    });
    it('refuses TRUNCATE', async () => {
      await expect(q(`TRUNCATE audit_log`)).rejects.toThrow(/append-only/);
    });
    it('documented maintenance exception works inside a transaction and restores protection', async () => {
      await q('BEGIN');
      await q('ALTER TABLE audit_log DISABLE TRIGGER trg_audit_log_no_update_delete');
      await q(`UPDATE audit_log SET action = 'Z' WHERE actor = 't'`);
      await q('ALTER TABLE audit_log ENABLE TRIGGER trg_audit_log_no_update_delete');
      await q('COMMIT');
      await expect(q(`UPDATE audit_log SET action = 'Y' WHERE actor = 't'`)).rejects.toThrow(/append-only/);
    });
  });

  describe('correction route with real SQL', () => {
    async function buyerWithCall(): Promise<{ id: number; ref: string }> {
      const ref = `T-${Math.random().toString(36).slice(2, 8)}`;
      const r = await q(
        `INSERT INTO buyers (company_name, contact_name, contact_email, telephone, industry_id, application_status,
           application_reference, onboarding_call_completed_at, onboarding_call_conducted_by)
         SELECT 'Co', 'A', 'x@y.com', '1', id, 'PENDING_COMMERCIALS', $1, now(), 'Fabien' FROM industries LIMIT 1 RETURNING id`,
        [ref]
      );
      return { id: r.rows[0].id, ref };
    }
    const mk = (body: object) => new NextRequest('http://localhost/x', { method: 'POST', body: JSON.stringify(body) });
    const GOOD = { confirm_correction: true, reason: 'Recorded against the wrong buyer by mistake.' };

    it('clears the record, keeps the original entry, and logs previous values and the reason', async () => {
      const { POST } = await import('../app/api/admin/applications/[reference]/onboarding-call/correct/route');
      const { id, ref } = await buyerWithCall();
      await q(`INSERT INTO audit_log (actor, action, entity_type, entity_id, new_state)
               VALUES ('owner@example.com','BUYER_ONBOARDING_CALL_RECORDED','buyer',$1,'{"conducted_by":"Fabien"}')`, [id]);
      const res = await POST(mk(GOOD), { params: { reference: ref } });
      expect(res.status).toBe(200);
      const b = await q(`SELECT onboarding_call_completed_at AS c, onboarding_call_conducted_by AS w FROM buyers WHERE id = $1`, [id]);
      expect(b.rows[0].c).toBeNull();
      expect(b.rows[0].w).toBeNull();
      const log = await q(`SELECT action, previous_state, new_state FROM audit_log WHERE entity_id = $1 ORDER BY id`, [id]);
      expect(log.rows.map((r: { action: string }) => r.action)).toEqual([
        'BUYER_ONBOARDING_CALL_RECORDED',
        'BUYER_ONBOARDING_CALL_CORRECTED',
      ]);
      expect(log.rows[1].previous_state.conducted_by).toBe('Fabien');
      expect(log.rows[1].previous_state.completed_at).toBeTruthy();
      expect(log.rows[1].new_state.reason).toBe(GOOD.reason);
    });

    it('a second correction is refused because nothing is recorded any more', async () => {
      const { POST } = await import('../app/api/admin/applications/[reference]/onboarding-call/correct/route');
      const { ref } = await buyerWithCall();
      expect((await POST(mk(GOOD), { params: { reference: ref } })).status).toBe(200);
      expect((await POST(mk(GOOD), { params: { reference: ref } })).status).toBe(409);
    });

    it('refuses once the buyer is ACTIVE and leaves the record and log untouched', async () => {
      const { POST } = await import('../app/api/admin/applications/[reference]/onboarding-call/correct/route');
      const { id, ref } = await buyerWithCall();
      await q(`UPDATE buyers SET application_status = 'ACTIVE' WHERE id = $1`, [id]);
      expect((await POST(mk(GOOD), { params: { reference: ref } })).status).toBe(409);
      const b = await q(`SELECT onboarding_call_conducted_by AS w FROM buyers WHERE id = $1`, [id]);
      expect(b.rows[0].w).toBe('Fabien');
      const log = await q(`SELECT count(*)::int AS n FROM audit_log WHERE entity_id = $1`, [id]);
      expect(log.rows[0].n).toBe(0);
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

type Row = Record<string, unknown>;
let buyer: Row | null;
let cteCleared = 1;
const executed: string[] = [];

vi.mock('@netlify/database', () => ({
  getDatabase: () => ({
    sql: async (strings: TemplateStringsArray) => {
      const text = strings.join(' ? ');
      executed.push(text);
      if (text.includes('WITH prev')) return [{ cleared: cteCleared, logged: cteCleared }];
      if (text.includes('FROM buyers')) return buyer ? [buyer] : [];
      return [];
    },
  }),
}));
let sessionRole: 'owner' | 'reviewer' = 'owner';
vi.mock('./requireAdmin', async () => {
  const { NextResponse } = await import('next/server');
  const session = () => ({ session: { email: 'admin@example.com', role: sessionRole } });
  return {
    requireAdmin: () => session(),
    requireOwner: () =>
      sessionRole === 'owner'
        ? session()
        : { response: NextResponse.json({ error: 'Owner role required.' }, { status: 403 }) },
  };
});

import { POST as activate } from '../app/api/admin/applications/[reference]/activate/route';
import { POST as correctCall } from '../app/api/admin/applications/[reference]/onboarding-call/correct/route';
import { POST as recordCall } from '../app/api/admin/applications/[reference]/onboarding-call/route';

const COMMERCIALS = {
  agreed_price_per_lead: 85,
  exclusivity_arrangement: 'exclusive',
  agreed_weekly_capacity: 5,
  payment_arrangement_notes: 'Pay by bank transfer before release',
};
const req = (body?: object) =>
  new NextRequest('http://localhost/x', { method: 'POST', body: body ? JSON.stringify(body) : undefined });
const CONFIRMED = { confirm_call_took_place: true };
const params = { params: { reference: 'HLX-BYR-000001' } };
const wroteStatus = () => executed.some((q) => q.includes("application_status = 'ACTIVE'"));
const wroteCall = () => executed.some((q) => q.includes('onboarding_call_completed_at ='));

beforeEach(() => {
  sessionRole = 'owner';
  cteCleared = 1;
  executed.length = 0;
  buyer = { id: 1, application_status: 'PENDING_COMMERCIALS', onboarding_call_completed_at: null, ...COMMERCIALS };
});

describe('activation requires a recorded onboarding call', () => {
  it('refuses to activate when no onboarding call is recorded, even with complete commercials', async () => {
    const res = await activate(req(), params);
    expect(res.status).toBe(422);
    expect((await res.json()).missing_requirements).toEqual(['onboarding_call']);
    expect(wroteStatus()).toBe(false);
  });

  it('still refuses when the call is recorded but commercials are incomplete', async () => {
    buyer = { ...buyer!, onboarding_call_completed_at: '2026-11-12T10:00:00Z', agreed_price_per_lead: null };
    const res = await activate(req(), params);
    expect(res.status).toBe(422);
    expect((await res.json()).missing_fields).toContain('agreed_price_per_lead');
    expect(wroteStatus()).toBe(false);
  });

  it('activates when the call is recorded and commercials are complete', async () => {
    buyer = { ...buyer!, onboarding_call_completed_at: '2026-11-12T10:00:00Z' };
    const res = await activate(req(), params);
    expect(res.status).toBe(200);
    expect(wroteStatus()).toBe(true);
  });

  it('keeps the existing rule that only PENDING_COMMERCIALS can activate', async () => {
    buyer = { ...buyer!, application_status: 'PENDING_REVIEW', onboarding_call_completed_at: '2026-11-12T10:00:00Z' };
    expect((await activate(req(), params)).status).toBe(409);
    expect(wroteStatus()).toBe(false);
  });
});

describe('recording the onboarding call', () => {
  it('records the call with who conducted it and writes an audit entry', async () => {
    const res = await recordCall(req({ conducted_by: 'Fabien', confirm_call_took_place: true }), params);
    expect(res.status).toBe(200);
    expect(wroteCall()).toBe(true);
    expect(executed.some((q) => q.includes('BUYER_ONBOARDING_CALL_RECORDED'))).toBe(true);
  });

  it('only allows recording after application review (PENDING_COMMERCIALS)', async () => {
    buyer = { ...buyer!, application_status: 'PENDING_REVIEW' };
    const res = await recordCall(req(CONFIRMED), params);
    expect(res.status).toBe(409);
    expect(wroteCall()).toBe(false);
  });

  it('refuses to record a second call and a future completion date', async () => {
    buyer = { ...buyer!, onboarding_call_completed_at: '2026-11-12T10:00:00Z' };
    expect((await recordCall(req(CONFIRMED), params)).status).toBe(409);
    buyer = { ...buyer!, onboarding_call_completed_at: null };
    expect((await recordCall(req({ ...CONFIRMED, completed_at: '2999-01-01T00:00:00Z' }), params)).status).toBe(400);
    expect(wroteCall()).toBe(false);
  });

  it('is owner-only: a reviewer cannot record the call', async () => {
    sessionRole = 'reviewer';
    const res = await recordCall(req(CONFIRMED), params);
    expect(res.status).toBe(403);
    expect(wroteCall()).toBe(false);
  });

  it('requires explicit confirmation that the call took place', async () => {
    expect((await recordCall(req(), params)).status).toBe(400);
    expect((await recordCall(req({ confirm_call_took_place: false }), params)).status).toBe(400);
    expect(wroteCall()).toBe(false);
  });

  it('validates and cleans the conductor field', async () => {
    for (const bad of ['', ' ', 'A', 'x'.repeat(101), 'Bad\nName', '<script>alert(1)</script>', 123, {}, ['a']]) {
      const res = await recordCall(req({ ...CONFIRMED, conducted_by: bad }), params);
      expect(res.status, JSON.stringify(bad)).toBe(400);
    }
    expect(wroteCall()).toBe(false);
    const ok = await recordCall(req({ ...CONFIRMED, conducted_by: '  Fabien   Alexander ' }), params);
    expect(ok.status).toBe(200);
    expect(executed.join('\n')).toContain('onboarding_call_conducted_by');
  });
});

describe('activation is owner-only', () => {
  it('a reviewer cannot activate, even with the call recorded and commercials complete', async () => {
    sessionRole = 'reviewer';
    buyer = { ...buyer!, onboarding_call_completed_at: '2026-11-12T10:00:00Z' };
    const res = await activate(req(), params);
    expect(res.status).toBe(403);
    expect(wroteStatus()).toBe(false);
  });
});

describe('correcting a mistaken call record', () => {
  const RECORDED = { onboarding_call_completed_at: '2026-11-12T10:00:00Z' };
  const GOOD = { confirm_correction: true, reason: 'Recorded against the wrong buyer by mistake.' };
  const wroteCorrection = () => executed.some((q) => q.includes('BUYER_ONBOARDING_CALL_CORRECTED'));

  it('clears the record and writes previous values plus the reason in one audited statement', async () => {
    buyer = { ...buyer!, ...RECORDED };
    const res = await correctCall(req(GOOD), params);
    expect(res.status).toBe(200);
    const q = executed.find((x) => x.includes('WITH prev'))!;
    expect(q).toContain('onboarding_call_completed_at = NULL');
    expect(q).toContain('INSERT INTO audit_log');
    expect(q).toContain('previous_state');
    expect(wroteCorrection()).toBe(true);
  });

  it('is owner-only', async () => {
    sessionRole = 'reviewer';
    buyer = { ...buyer!, ...RECORDED };
    expect((await correctCall(req(GOOD), params)).status).toBe(403);
    expect(wroteCorrection()).toBe(false);
  });

  it('requires explicit confirmation and a written reason', async () => {
    buyer = { ...buyer!, ...RECORDED };
    expect((await correctCall(req({ reason: GOOD.reason }), params)).status).toBe(400);
    expect((await correctCall(req({ confirm_correction: true }), params)).status).toBe(400);
    for (const bad of ['', 'short', 'x'.repeat(501), '<b>bad reason here</b>', 123, null]) {
      expect((await correctCall(req({ confirm_correction: true, reason: bad }), params)).status, JSON.stringify(bad)).toBe(400);
    }
    expect(wroteCorrection()).toBe(false);
  });

  it('is only available while PENDING_COMMERCIALS', async () => {
    buyer = { ...buyer!, ...RECORDED, application_status: 'ACTIVE' };
    expect((await correctCall(req(GOOD), params)).status).toBe(409);
    expect(wroteCorrection()).toBe(false);
  });

  it('refuses when there is no call record to correct', async () => {
    expect((await correctCall(req(GOOD), params)).status).toBe(409);
    expect(wroteCorrection()).toBe(false);
  });

  it('reports a conflict if the row changed underneath (nothing cleared)', async () => {
    buyer = { ...buyer!, ...RECORDED };
    cteCleared = 0;
    expect((await correctCall(req(GOOD), params)).status).toBe(409);
  });
});

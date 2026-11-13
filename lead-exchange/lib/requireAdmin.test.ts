import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

let adminRows: Array<Record<string, unknown>> = [];
let dbFails = false;
const executed: Array<{ text: string; values: unknown[] }> = [];
vi.mock('@netlify/database', () => ({
  getDatabase: () => ({
    sql: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      if (dbFails) throw new Error('db down');
      executed.push({ text: strings.join(' ? '), values });
      return adminRows;
    },
  }),
}));

process.env.ADMIN_SESSION_SECRET = 'test-secret-for-unit-tests-only';
import { createHmac } from 'crypto';
import { createSessionToken, SESSION_COOKIE_NAME } from './adminSession';
import { POST as logout } from '../app/api/admin/logout/route';
import { requireAdmin, requireOwner } from './requireAdmin';

const cookieReq = (token?: string) =>
  new NextRequest('http://localhost/x', { headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {} });
const ownerToken = () => createSessionToken({ id: 7, email: 'boss@example.com', role: 'owner', sessionVersion: 3 });

beforeEach(() => {
  dbFails = false;
  adminRows = [{ id: 7, email: 'boss@example.com', role: 'owner', session_version: 3 }];
  executed.length = 0;
});

describe('admin session role revalidation', () => {
  it('rejects a request with no session', async () => {
    const r = await requireAdmin(cookieReq());
    expect('response' in r && r.response.status).toBe(401);
  });

  it('accepts a valid session and uses the live role', async () => {
    const r = await requireOwner(cookieReq(ownerToken()));
    expect('session' in r && r.session.role).toBe('owner');
  });

  it('a demoted admin is signed out entirely on the next request (demotion bumps the version)', async () => {
    adminRows = [{ id: 7, email: 'boss@example.com', role: 'reviewer', session_version: 4 }];
    const owner = await requireOwner(cookieReq(ownerToken()));
    expect('response' in owner && owner.response.status).toBe(401);
    const admin = await requireAdmin(cookieReq(ownerToken()));
    expect('response' in admin && admin.response.status).toBe(401);
  });

  it('belt and braces: even if a role changed WITHOUT a version bump, the live role still wins', async () => {
    adminRows = [{ id: 7, email: 'boss@example.com', role: 'reviewer', session_version: 3 }];
    const owner = await requireOwner(cookieReq(ownerToken()));
    expect('response' in owner && owner.response.status).toBe(403);
    const admin = await requireAdmin(cookieReq(ownerToken()));
    expect('session' in admin && admin.session.role).toBe('reviewer');
  });

  it('a promoted reviewer is not stuck on the old role either', async () => {
    const token = createSessionToken({ id: 7, email: 'boss@example.com', role: 'reviewer', sessionVersion: 3 });
    const r = await requireOwner(cookieReq(token));
    expect('session' in r && r.session.role).toBe('owner');
  });

  it('a deleted admin is rejected outright', async () => {
    adminRows = [];
    const r = await requireAdmin(cookieReq(ownerToken()));
    expect('response' in r && r.response.status).toBe(401);
  });

  it('rejects when the id now belongs to a different email', async () => {
    adminRows = [{ id: 7, email: 'someone-else@example.com', role: 'owner', session_version: 3 }];
    const r = await requireAdmin(cookieReq(ownerToken()));
    expect('response' in r && r.response.status).toBe(401);
  });

  it('fails closed (503) if the database cannot be reached', async () => {
    dbFails = true;
    const r = await requireOwner(cookieReq(ownerToken()));
    expect('response' in r && r.response.status).toBe(503);
  });

  it('rejects a tampered token', async () => {
    const r = await requireAdmin(cookieReq(ownerToken().replace(/.$/, 'x')));
    expect('response' in r && r.response.status).toBe(401);
  });
});

describe('session version invalidation', () => {
  it('rejects a cookie whose version is older than the database value (logout, password or role change)', async () => {
    adminRows = [{ id: 7, email: 'boss@example.com', role: 'owner', session_version: 4 }];
    const r = await requireAdmin(cookieReq(ownerToken())); // token carries version 3
    expect('response' in r && r.response.status).toBe(401);
    const o = await requireOwner(cookieReq(ownerToken()));
    expect('response' in o && o.response.status).toBe(401);
  });

  it('rejects a cookie with a version NEWER than the database (forged or rolled-back state)', async () => {
    adminRows = [{ id: 7, email: 'boss@example.com', role: 'owner', session_version: 2 }];
    const r = await requireAdmin(cookieReq(ownerToken()));
    expect('response' in r && r.response.status).toBe(401);
  });

  it('rejects an old-format cookie that has no version, even with a valid signature', async () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = Buffer.from(
      JSON.stringify({ adminId: 7, email: 'boss@example.com', role: 'owner', issuedAt: now, expiresAt: now + 3600 })
    ).toString('base64url');
    const sig = createHmac('sha256', process.env.ADMIN_SESSION_SECRET!).update(payload).digest('base64url');
    const r = await requireAdmin(cookieReq(`${payload}.${sig}`));
    expect('response' in r && r.response.status).toBe(401);
  });

  it('a version cannot be edited in the cookie (signature breaks)', async () => {
    const [payload, sig] = ownerToken().split('.');
    const edited = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), sessionVersion: 99 })
    ).toString('base64url');
    const r = await requireAdmin(cookieReq(`${edited}.${sig}`));
    expect('response' in r && r.response.status).toBe(401);
  });
});

describe('logout revokes the session', () => {
  const logoutReq = (token?: string) =>
    new NextRequest('http://localhost/x', { method: 'POST', headers: token ? { cookie: `${SESSION_COOKIE_NAME}=${token}` } : {} });

  it('bumps session_version, guarded by the cookie version, and clears the cookie', async () => {
    const res = await logout(logoutReq(ownerToken()));
    expect(res.status).toBe(200);
    const q = executed.find((e) => e.text.includes('UPDATE admin_users SET session_version'))!;
    expect(q.text).toContain('session_version = session_version + 1');
    expect(q.text).toContain('AND session_version =');
    expect(q.values).toEqual([7, 3]);
    expect(res.headers.get('set-cookie')).toMatch(/Max-Age=0/i);
  });

  it('does nothing to the database for a missing or invalid cookie, but still clears it', async () => {
    for (const t of [undefined, 'garbage.token']) {
      const res = await logout(logoutReq(t));
      expect(res.status).toBe(200);
      expect(res.headers.get('set-cookie')).toMatch(/Max-Age=0/i);
    }
    expect(executed.length).toBe(0);
  });

  it('still clears the cookie but reports failure if revocation cannot be saved', async () => {
    dbFails = true;
    const res = await logout(logoutReq(ownerToken()));
    expect(res.status).toBe(503);
    expect((await res.json()).sessionRevoked).toBe(false);
    expect(res.headers.get('set-cookie')).toMatch(/Max-Age=0/i);
  });
});

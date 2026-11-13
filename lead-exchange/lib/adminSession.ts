import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest } from 'next/server';
import { BASE_PATH } from './basePath';

export const SESSION_COOKIE_NAME = 'halo_admin_session';
const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours

export interface AdminSessionPayload {
  adminId: number;
  email: string;
  role: 'owner' | 'reviewer';
  /** admin_users.session_version at issue time. A mismatch with the database invalidates the cookie. */
  sessionVersion: number;
  issuedAt: number;
  expiresAt: number;
}

function getSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    // Fail loudly rather than fall back to a default — an admin session secret must never be
    // guessable, and a missing env var is a deployment misconfiguration, not a runtime fallback case.
    throw new Error('ADMIN_SESSION_SECRET is not set. Admin authentication cannot operate without it.');
  }
  return secret;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function sign(payloadB64: string): string {
  return createHmac('sha256', getSecret()).update(payloadB64).digest('base64url');
}

export function createSessionToken(admin: {
  id: number;
  email: string;
  role: 'owner' | 'reviewer';
  sessionVersion: number;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    adminId: admin.id,
    email: admin.email,
    role: admin.role,
    sessionVersion: admin.sessionVersion,
    issuedAt: now,
    expiresAt: now + SESSION_TTL_SECONDS,
  };
  const payloadB64 = base64url(JSON.stringify(payload));
  const signature = sign(payloadB64);
  return `${payloadB64}.${signature}`;
}

/**
 * Verifies a session token's signature and expiry. This is the ONLY function admin API routes
 * should trust — never infer admin status from a cookie's mere presence or from client-reported
 * state. Every administrative route must call this independently (brief: "Server-side
 * authorisation on every administrative operation," "No reliance on hiding frontend pages").
 */
export function verifySessionToken(token: string | undefined | null): AdminSessionPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;

  const expectedSignature = sign(payloadB64);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload: AdminSessionPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (typeof payload.expiresAt !== 'number' || payload.expiresAt < Math.floor(Date.now() / 1000)) {
      return null;
    }
    // Cookies without a version (issued before session versions existed) are not accepted.
    if (!Number.isInteger(payload.sessionVersion)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getAdminSession(req: NextRequest): AdminSessionPayload | null {
  return verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict' as const,
  // Scoped to BASE_PATH, not '/', so the admin session cookie is never sent to requests outside
  // the Lead Exchange section once it's served under halostrategic.com/leads-exchange -- it
  // shouldn't be attached to every request to the main marketing site just because they share an
  // origin under the reverse-proxy setup.
  path: BASE_PATH,
  maxAge: SESSION_TTL_SECONDS,
};

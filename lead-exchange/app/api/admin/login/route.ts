import { getDatabase } from '@netlify/database';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '../../../../lib/adminSession';

// Minimal in-memory rate limiting per Netlify Function instance. This is a floor, not a ceiling —
// serverless instances are ephemeral and multiple may run concurrently, so this does not replace
// a real rate-limiter (see Phase 1 security checklist). It stops the simplest brute-force attempts.
const attempts = new Map<string, { count: number; firstAttemptAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.firstAttemptAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttemptAt: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-nf-client-connection-ip') ?? req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many login attempts. Try again later.' }, { status: 429 });
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (!body.email || !body.password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
  }

  const db = getDatabase();
  const rows = await db.sql`
    SELECT id, email, password_hash, role, session_version FROM admin_users WHERE email = ${body.email}
  `;

  // Same generic error whether the email doesn't exist or the password is wrong — never reveal
  // which one, that's an enumeration leak.
  const genericError = NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
  if (rows.length === 0) return genericError;

  const admin = rows[0];
  const passwordOk = await bcrypt.compare(body.password, admin.password_hash);
  if (!passwordOk) return genericError;

  await db.sql`UPDATE admin_users SET last_login_at = now() WHERE id = ${admin.id}`;

  const token = createSessionToken({
    id: admin.id,
    email: admin.email,
    role: admin.role,
    sessionVersion: admin.session_version,
  });
  const res = NextResponse.json({ email: admin.email, role: admin.role });
  res.cookies.set(SESSION_COOKIE_NAME, token, SESSION_COOKIE_OPTIONS);
  return res;
}

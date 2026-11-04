import { getDatabase } from '@netlify/database';
import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

// Same security model as /api/admin/setup: production-host-only, constant-time token check
// against the same ADMIN_SETUP_TOKEN (already treated as a sensitive break-glass credential,
// kept out of chat and git). This is a temporary recovery tool for the specific situation where
// a bootstrap may or may not have actually succeeded and the resulting password is unknown/lost
// -- it should be removed once no longer needed, not left as permanent standing surface.
const ALLOWED_HOSTS = ['halo-lead-exchange.netlify.app'];

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function checkAuth(req: NextRequest): NextResponse | null {
  const host = req.headers.get('host');
  if (!host || !ALLOWED_HOSTS.includes(host)) {
    return NextResponse.json({ error: 'Not available on this deployment.' }, { status: 403 });
  }
  const setupToken = process.env.ADMIN_SETUP_TOKEN;
  if (!setupToken) {
    return NextResponse.json({ error: 'Not configured on this deployment.' }, { status: 503 });
  }
  const providedToken = req.headers.get('x-admin-setup-token');
  if (!providedToken || !constantTimeEquals(providedToken, setupToken)) {
    return NextResponse.json({ error: 'Invalid or missing token.' }, { status: 403 });
  }
  return null;
}

// GET: check whether a row exists for this email, WITHOUT ever returning the password hash.
export async function GET(req: NextRequest) {
  const authError = checkAuth(req);
  if (authError) return authError;

  const email = req.nextUrl.searchParams.get('email');
  if (!email) {
    return NextResponse.json({ error: 'An email query param is required.' }, { status: 400 });
  }

  const db = getDatabase();
  const rows = await db.sql`
    SELECT id, email, role, created_at, last_login_at FROM admin_users WHERE email = ${email}
  `;

  if (rows.length === 0) {
    return NextResponse.json({ exists: false });
  }
  return NextResponse.json({
    exists: true,
    email: rows[0].email,
    role: rows[0].role,
    created_at: rows[0].created_at,
    last_login_at: rows[0].last_login_at,
  });
}

// DELETE: remove the row for this email, logged to audit_log, so the one-time setup endpoint
// can run again. Only acts if exactly one matching row exists.
export async function DELETE(req: NextRequest) {
  const authError = checkAuth(req);
  if (authError) return authError;

  const email = req.nextUrl.searchParams.get('email');
  if (!email) {
    return NextResponse.json({ error: 'An email query param is required.' }, { status: 400 });
  }

  const db = getDatabase();
  const existing = await db.sql`SELECT id FROM admin_users WHERE email = ${email}`;
  if (existing.length === 0) {
    return NextResponse.json({ deleted: false, message: 'No matching admin account found.' }, { status: 404 });
  }

  const adminId = existing[0].id;
  await db.sql`DELETE FROM admin_users WHERE id = ${adminId}`;
  await db.sql`
    INSERT INTO audit_log (actor, action, entity_type, entity_id, previous_state)
    VALUES ('system-recovery', 'ADMIN_ACCOUNT_DELETED_FOR_RECOVERY', 'admin_user', ${adminId}, ${JSON.stringify({ email })})
  `;

  return NextResponse.json({ deleted: true, email });
}

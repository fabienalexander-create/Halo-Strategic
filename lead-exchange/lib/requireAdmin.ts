import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, AdminSessionPayload } from './adminSession';

/**
 * Call this at the top of every admin API route handler. Returns the verified session, or a
 * response to return immediately. This is the server-side enforcement point: the admin UI
 * hiding a page or button is a UX convenience only, never the actual security boundary.
 *
 * The signed cookie proves who logged in and when. It is NOT trusted for the role. On every
 * request the admin account is looked up in admin_users and the CURRENT role is used, so a
 * demoted or deleted admin loses elevated access on their very next request, without waiting
 * for the 12 hour session to expire. The cookie also carries the admin's session_version, which
 * must equal the current database value, so logout, a password change or a role change kills every
 * cookie issued earlier. If the lookup fails we fail closed (503), never open.
 */
export async function requireAdmin(
  req: NextRequest
): Promise<{ session: AdminSessionPayload } | { response: NextResponse }> {
  const session = getAdminSession(req);
  if (!session) {
    return { response: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) };
  }

  let rows: Array<{ id: number; email: string; role: string; session_version: number }>;
  try {
    const db = getDatabase();
    rows = await db.sql`SELECT id, email, role, session_version FROM admin_users WHERE id = ${session.adminId}`;
  } catch (err) {
    console.error('Admin session revalidation failed', err);
    return { response: NextResponse.json({ error: 'Unable to verify admin access.' }, { status: 503 }) };
  }

  const live = rows[0];
  // Account removed, or the id now belongs to a different email: treat the session as invalid.
  // A session_version mismatch means the admin logged out, changed password or had their role
  // changed since this cookie was issued, so the cookie (possibly a stolen copy) is dead.
  if (
    !live ||
    live.email !== session.email ||
    live.session_version !== session.sessionVersion ||
    (live.role !== 'owner' && live.role !== 'reviewer')
  ) {
    return { response: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) };
  }

  return { session: { ...session, role: live.role } };
}

export async function requireOwner(
  req: NextRequest
): Promise<{ session: AdminSessionPayload } | { response: NextResponse }> {
  const result = await requireAdmin(req);
  if ('response' in result) return result;
  if (result.session.role !== 'owner') {
    return { response: NextResponse.json({ error: 'Owner role required.' }, { status: 403 }) };
  }
  return result;
}

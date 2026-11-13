import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, verifySessionToken } from '../../../../lib/adminSession';

// Logout does two things: clears the cookie in this browser, and bumps the admin's session_version
// so every cookie issued before now (including any stolen copy) stops working. That also signs the
// admin out on their other devices. The bump only happens for a cookie that is still current, so a
// stale cookie cannot be used to kick a newer legitimate session out.
export async function POST(req: NextRequest) {
  let revoked = true;
  const session = verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (session) {
    try {
      const db = getDatabase();
      await db.sql`
        UPDATE admin_users SET session_version = session_version + 1
        WHERE id = ${session.adminId} AND session_version = ${session.sessionVersion}
      `;
    } catch (err) {
      console.error('Session revocation on logout failed', err);
      revoked = false;
    }
  }
  const res = NextResponse.json(
    revoked ? { loggedOut: true } : { loggedOut: true, sessionRevoked: false },
    { status: revoked ? 200 : 503 }
  );
  // Must use the same path the cookie was set with (BASE_PATH), otherwise the browser keeps it.
  res.cookies.set(SESSION_COOKIE_NAME, '', { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  return res;
}

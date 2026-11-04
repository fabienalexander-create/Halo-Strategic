import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, AdminSessionPayload } from './adminSession';

/**
 * Call this at the top of every admin API route handler. Returns the verified session, or a
 * 401 response to return immediately. This is the server-side enforcement point — the admin UI
 * hiding a page or button is a UX convenience only, never the actual security boundary.
 */
export function requireAdmin(req: NextRequest): { session: AdminSessionPayload } | { response: NextResponse } {
  const session = getAdminSession(req);
  if (!session) {
    return { response: NextResponse.json({ error: 'Not authenticated.' }, { status: 401 }) };
  }
  return { session };
}

export function requireOwner(req: NextRequest): { session: AdminSessionPayload } | { response: NextResponse } {
  const result = requireAdmin(req);
  if ('response' in result) return result;
  if (result.session.role !== 'owner') {
    return { response: NextResponse.json({ error: 'Owner role required.' }, { status: 403 }) };
  }
  return result;
}

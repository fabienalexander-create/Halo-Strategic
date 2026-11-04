import { getDatabase } from '@netlify/database';
import bcrypt from 'bcryptjs';
import { NextRequest, NextResponse } from 'next/server';

/**
 * One-time bootstrap: creates the first admin account. No public registration exists anywhere
 * else in this application. This endpoint refuses to run a second time (once any admin_users
 * row exists) and requires a bootstrap token set as an env var — never committed, never
 * guessable from the client.
 */
export async function POST(req: NextRequest) {
  const setupToken = process.env.ADMIN_SETUP_TOKEN;
  if (!setupToken) {
    return NextResponse.json({ error: 'Admin setup is not configured on this deployment.' }, { status: 503 });
  }

  const providedToken = req.headers.get('x-admin-setup-token');
  if (!providedToken || providedToken !== setupToken) {
    return NextResponse.json({ error: 'Invalid or missing setup token.' }, { status: 403 });
  }

  const db = getDatabase();
  const existing = await db.sql`SELECT COUNT(*)::int AS count FROM admin_users`;
  if (existing[0]?.count > 0) {
    return NextResponse.json(
      { error: 'An admin account already exists. This endpoint only runs once.' },
      { status: 409 }
    );
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (!body.email || !body.password || body.password.length < 12) {
    return NextResponse.json(
      { error: 'email and password (minimum 12 characters) are required.' },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(body.password, 12);
  const result = await db.sql`
    INSERT INTO admin_users (email, password_hash, role)
    VALUES (${body.email}, ${passwordHash}, 'owner')
    RETURNING id, email, role
  `;

  await db.sql`
    INSERT INTO audit_log (actor, action, entity_type, entity_id, new_state)
    VALUES ('system', 'ADMIN_ACCOUNT_BOOTSTRAPPED', 'admin_user', ${result[0].id}, ${JSON.stringify({ email: body.email, role: 'owner' })})
  `;

  return NextResponse.json({ created: true, email: result[0].email, role: result[0].role }, { status: 201 });
}

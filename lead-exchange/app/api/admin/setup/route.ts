import { getDatabase } from '@netlify/database';
import bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Explicit allowlist, checked against the request's own Host header -- not Netlify's CONTEXT
// build variable, whose availability inside a running serverless function at request time isn't
// something this route should assume without direct verification. Deploy previews and branch
// deploys get distinct subdomains (e.g. <deploy-id>--halo-lead-exchange.netlify.app), so they're
// excluded by construction, not by trusting an env var. Add leads.halostrategic.com here once that
// custom domain is actually configured -- it is NOT live yet (see README).
const ALLOWED_SETUP_HOSTS = ['halo-lead-exchange.netlify.app'];

/**
 * One-time bootstrap: creates the first admin account. No public registration exists anywhere
 * else in this application. This endpoint refuses to run a second time (once any admin_users
 * row exists), requires a bootstrap token set as an env var — never committed, never guessable
 * from the client — and refuses to run anywhere except the real production hostname, so a deploy
 * preview or branch deploy can never be used to bootstrap a rogue admin account.
 */
export async function POST(req: NextRequest) {
  const host = req.headers.get('host');
  if (!host || !ALLOWED_SETUP_HOSTS.includes(host)) {
    return NextResponse.json({ error: 'Admin setup is not available on this deployment.' }, { status: 403 });
  }

  const setupToken = process.env.ADMIN_SETUP_TOKEN;
  if (!setupToken) {
    return NextResponse.json({ error: 'Admin setup is not configured on this deployment.' }, { status: 503 });
  }

  const providedToken = req.headers.get('x-admin-setup-token');
  if (!providedToken || !constantTimeEquals(providedToken, setupToken)) {
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

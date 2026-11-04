import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';

// Minimal in-memory rate limiting per Netlify Function instance — a floor, not a replacement for
// a real rate-limiter, same approach as /api/admin/login.
const submissions = new Map<string, { count: number; firstAttemptAt: number }>();
const MAX_SUBMISSIONS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = submissions.get(key);
  if (!entry || now - entry.firstAttemptAt > WINDOW_MS) {
    submissions.set(key, { count: 1, firstAttemptAt: now });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_SUBMISSIONS;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-nf-client-connection-ip') ?? req.headers.get('x-forwarded-for') ?? 'unknown';
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: 'Too many messages sent. Please try again later.' }, { status: 429 });
  }

  let body: { name?: string; email?: string; message?: string; bot_field?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  // Simple honeypot: a real visitor never fills this field in.
  if (body.bot_field) {
    return NextResponse.json({ error: 'Submission rejected.' }, { status: 400 });
  }
  if (!body.name || !body.email || !body.message) {
    return NextResponse.json({ error: 'Name, email and message are all required.' }, { status: 400 });
  }

  const db = getDatabase();
  await db.sql`
    INSERT INTO contact_messages (name, email, message)
    VALUES (${body.name}, ${body.email}, ${body.message})
  `;

  return NextResponse.json({ received: true }, { status: 201 });
}

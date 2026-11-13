import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { recordUnsubscribe, UnsubscribeMethod, UnsubscribeScope } from '../../../../lib/prospectUnsubscribe';

const VALID_SCOPES: UnsubscribeScope[] = ['intro', 'marketing', 'all'];

// Handles two distinct callers with the same route:
//
// 1. A person on the unsubscribe landing page (app/become-a-buyer/unsubscribe/page.tsx) choosing
//    what to stop, via a normal JSON POST with { token, scope }.
// 2. A mail client's native one-click "Unsubscribe" button, per RFC 8058's List-Unsubscribe-Post:
//    it POSTs application/x-www-form-urlencoded body "List-Unsubscribe=One-Click" to the exact URL
//    in the List-Unsubscribe header (see lib/emailTemplates.ts), with no further user interaction.
//    That header is only ever attached to the bounded introductory sequence, so a one-click request
//    always means scope "intro" -- it must never be read as withdrawing marketing consent, which is
//    a separate permission the recipient was never asked about via this mechanism.
//
// Idempotent in both cases: unsubscribing twice, or an already-applied scope, is 200 OK, never an
// error -- a mail client retrying a webhook-style request, or a person clicking an old link twice,
// must never see a failure.
export async function POST(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? '';
  let token: unknown;
  let scope: unknown;
  let method: UnsubscribeMethod = 'link';

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    if (params.get('List-Unsubscribe') === 'One-Click') {
      token = new URL(req.url).searchParams.get('token');
      scope = 'intro';
      method = 'one_click';
    } else {
      return NextResponse.json({ error: 'Unrecognised form submission.' }, { status: 400 });
    }
  } else {
    let body: { token?: unknown; scope?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }
    token = body.token;
    scope = body.scope;
  }

  if (typeof scope !== 'string' || !VALID_SCOPES.includes(scope as UnsubscribeScope)) {
    return NextResponse.json({ error: 'scope must be one of: intro, marketing, all.' }, { status: 400 });
  }
  if (typeof token !== 'string' || !token) {
    return NextResponse.json({ error: 'A valid token is required.' }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const result = await recordUnsubscribe(db, token, scope as UnsubscribeScope, method);
    if (!result.found) {
      // Deliberately generic -- this is a public, unauthenticated endpoint. A malformed or unknown
      // token gets the same response either way; nothing here reveals whether a token almost
      // matched something real.
      return NextResponse.json({ error: 'This link is invalid or has expired.' }, { status: 404 });
    }
    return NextResponse.json({ scope: result.scope, alreadyApplied: result.alreadyApplied ?? false });
  } catch (err) {
    console.error('Prospect unsubscribe failed', err);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

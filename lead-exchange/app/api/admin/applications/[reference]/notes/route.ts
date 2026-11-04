import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../../lib/requireAdmin';

export async function POST(req: NextRequest, { params }: { params: { reference: string } }) {
  const auth = requireAdmin(req);
  if ('response' in auth) return auth.response;

  let body: { note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  if (!body.note || !body.note.trim()) {
    return NextResponse.json({ error: 'A non-empty note is required.' }, { status: 400 });
  }

  try {
    const db = getDatabase();
    const buyers = await db.sql`SELECT id FROM buyers WHERE application_reference = ${params.reference}`;
    if (buyers.length === 0) {
      return NextResponse.json({ error: 'No matching application found.' }, { status: 404 });
    }

    const result = await db.sql`
      INSERT INTO buyer_review_notes (buyer_id, admin_email, note)
      VALUES (${buyers[0].id}, ${auth.session.email}, ${body.note.trim()})
      RETURNING id, admin_email, note, created_at
    `;

    return NextResponse.json({ note: result[0] }, { status: 201 });
  } catch (err) {
    console.error('Adding review note failed', err);
    return NextResponse.json({ error: 'Failed to add note.' }, { status: 500 });
  }
}

import { getDatabase } from '@netlify/database';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/requireAdmin';

interface Body {
  buyer_id?: number;
  package_definition_id?: number;
  amount_paid?: number;
  currency?: string;
  leads_included?: number;
  transaction_reference?: string;
  paid_at?: string;
  // Booked appointments (2026-11-26): what the package's credits can be spent on. Taken from the
  // package definition when one is given; the database refuses a mismatch.
  lead_type?: 'VERIFIED_ENQUIRY' | 'BOOKED_APPOINTMENT';
}

// Records a buyer package an admin has already verified against Tide -- amount_paid,
// leads_included and currency are always given explicitly on the request (not looked up from
// package_definitions), so an ad hoc package (no package_definitions row) works the same as one
// based on a configured definition. leads_used starts at 0 and from here on is maintained only by
// the lead_allocations guard trigger (buyer_packages_guard_leads_used) -- this route never sets it.
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ('response' in auth) return auth.response;

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.buyer_id) {
    return NextResponse.json({ error: 'buyer_id is required.' }, { status: 400 });
  }
  if (!body.amount_paid || body.amount_paid < 0) {
    return NextResponse.json({ error: 'amount_paid must be a non-negative number.' }, { status: 400 });
  }
  if (!body.leads_included || body.leads_included <= 0) {
    return NextResponse.json({ error: 'leads_included must be a positive integer.' }, { status: 400 });
  }
  if (!body.transaction_reference?.trim()) {
    return NextResponse.json({ error: 'transaction_reference (the Tide reference) is required.' }, { status: 400 });
  }
  if (!body.paid_at) {
    return NextResponse.json({ error: 'paid_at is required.' }, { status: 400 });
  }

  try {
    const db = getDatabase();

    const buyers = await db.sql`SELECT id, application_status FROM buyers WHERE id = ${body.buyer_id}`;
    if (buyers.length === 0) {
      return NextResponse.json({ error: 'No matching buyer found.' }, { status: 404 });
    }
    if (buyers[0].application_status !== 'ACTIVE') {
      return NextResponse.json(
        { error: `Buyer is not ACTIVE (currently ${buyers[0].application_status}); cannot record a package.` },
        { status: 409 }
      );
    }

    if (body.lead_type !== undefined && body.lead_type !== 'VERIFIED_ENQUIRY' && body.lead_type !== 'BOOKED_APPOINTMENT') {
      return NextResponse.json({ error: "lead_type must be 'VERIFIED_ENQUIRY' or 'BOOKED_APPOINTMENT'." }, { status: 400 });
    }
    let leadType: string = body.lead_type ?? 'VERIFIED_ENQUIRY';
    if (body.package_definition_id) {
      const defs = await db.sql`SELECT id, active, lead_type FROM package_definitions WHERE id = ${body.package_definition_id}`;
      if (defs.length === 0) {
        return NextResponse.json({ error: 'No matching package definition found.' }, { status: 404 });
      }
      if (body.lead_type && body.lead_type !== defs[0].lead_type) {
        return NextResponse.json({ error: `That package definition is for ${defs[0].lead_type} leads.` }, { status: 400 });
      }
      leadType = defs[0].lead_type as string;
    }

    let inserted;
    try {
      inserted = await db.sql`
        INSERT INTO buyer_packages (
          buyer_id, package_definition_id, amount_paid, currency, leads_included,
          transaction_reference, paid_at, verified_by, lead_type
        ) VALUES (
          ${body.buyer_id}, ${body.package_definition_id ?? null}, ${body.amount_paid}, ${body.currency ?? 'GBP'},
          ${body.leads_included}, ${body.transaction_reference}, ${body.paid_at}, ${auth.session.email}, ${leadType}
        )
        RETURNING id, expires_at
      `;
    } catch (err) {
      // uq on transaction_reference -- a Tide reference already recorded against another package
      // (or payment) is a 409, not a 500: this is an expected, recoverable mistake (wrong ref
      // typed in, or the same package submitted twice), not a system failure.
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('transaction_reference')) {
        return NextResponse.json({ error: 'This transaction reference has already been recorded.' }, { status: 409 });
      }
      throw err;
    }
    const packageId = inserted[0].id;

    await db.sql`
      INSERT INTO audit_log (actor, action, entity_type, entity_id, new_state)
      VALUES (
        ${auth.session.email}, 'BUYER_PACKAGE_RECORDED', 'buyer_package', ${packageId},
        ${JSON.stringify({ buyer_id: body.buyer_id, amount_paid: body.amount_paid, leads_included: body.leads_included, lead_type: leadType, expires_at: inserted[0].expires_at })}
      )
    `;

    // expires_at is set by the database: six months (or the package definition's validity) after
    // verification (credits ledger, 2026-11-26).
    return NextResponse.json({ id: packageId, lead_type: leadType, expires_at: inserted[0].expires_at }, { status: 201 });
  } catch (err) {
    console.error('Recording buyer package failed', err);
    return NextResponse.json({ error: 'Failed to record package.' }, { status: 500 });
  }
}

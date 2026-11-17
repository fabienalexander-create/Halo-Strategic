// Fabien, 2026-11-18: consent to contact a buyer prospect can now come from a step before they
// sign up -- submitting the become-a-buyer application itself, which already requires ticking
// "I agree to receive relevant account and lead notifications" (agreed_account_notifications).
// When that application is linked back to an earlier buyer_prospects registration (the matching
// already built in app/api/buyer-applications/route.ts), the manual admin step of recording
// personal_contact_authorised_at is no longer needed for that prospect -- the applicant just gave
// it themselves, in writing, by applying.
//
// This must run inside the SAME transaction as the buyer_applications INSERT that triggers it, so
// an application that commits always has its prospect's authorisation committed with it, and one
// that rolls back never leaves a dangling authorisation. lib/buyerProspectSalesPipeline.ts's
// recordSalesActivity opens its own transaction via db.pool.connect() and can't be reused here for
// that reason -- this takes the already-open client directly instead.

export interface AutoAuthoriseParams {
  prospectId: number;
  currentSalesStage: string;
  personalContactAuthorisedAt: string | Date | null;
  applicationReference: string;
}

interface PgClient {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

// Only acts when the prospect is still at NEW with no authorisation already recorded -- never
// overwrites an authorisation an admin already made (whatever its basis), and never advances a
// prospect who has already moved further through the sales pipeline than that. Returns whether it
// actually authorised anything, so the caller can decide whether to mention it.
export async function autoAuthoriseContactFromApplication(client: PgClient, p: AutoAuthoriseParams): Promise<boolean> {
  if (p.currentSalesStage !== 'NEW' || p.personalContactAuthorisedAt !== null) return false;

  const basis =
    `Applicant submitted their own buyer application (${p.applicationReference}), agreeing to ` +
    `receive relevant account and lead notifications (agreed_account_notifications) -- the ` +
    `application itself is the authorisation, not the earlier registration of interest alone.`;

  await client.query(
    `UPDATE buyer_prospects
     SET sales_stage = 'CONTACT_AUTHORISED', personal_contact_authorised_at = now(),
         personal_contact_authorised_by = 'system', contact_authorisation_basis = $1
     WHERE id = $2`,
    [basis, p.prospectId]
  );

  await client.query(
    `INSERT INTO buyer_prospect_sales_activity (prospect_id, activity_type, previous_stage, new_stage, note, recorded_by)
     VALUES ($1, 'STAGE_CHANGE', 'NEW', 'CONTACT_AUTHORISED', $2, 'system')`,
    [p.prospectId, `Auto-authorised on submission of buyer application ${p.applicationReference}.`]
  );

  // Same append-only audit trail every other authorisation decision in this codebase uses (see
  // lib/buyerProspectSalesPipeline.ts's own BUYER_PROSPECT_CONTACT_AUTHORISED entry) -- this is the
  // one event the whole feature exists to make provable later, manual or automatic.
  await client.query(
    `INSERT INTO audit_log (actor, action, entity_type, entity_id, previous_state, new_state)
     VALUES ('system', 'BUYER_PROSPECT_CONTACT_AUTHORISED', 'buyer_prospect', $1, $2, $3)`,
    [
      p.prospectId,
      JSON.stringify({ personal_contact_authorised_at: null }),
      JSON.stringify({
        personal_contact_authorised_at: new Date().toISOString(),
        basis,
        source: 'buyer_application',
        application_reference: p.applicationReference,
      }),
    ]
  );

  return true;
}

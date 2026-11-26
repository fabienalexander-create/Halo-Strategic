// Credits ledger operations (Technical PR A, approved by Fabien 2026-11-26): replacement requests,
// credit restoration and unused-credit refunds for starter-pack packages.
//
// Every rule that protects money lives in the database (migration 20261126100000_credits_ledger.sql):
// the balance can never go below zero, a delivered lead can have only one open claim, a claim is
// decided and resolved once, a credit is restored once, and a refund must equal the price paid. The
// functions here run each operation in one transaction with its audit entry and turn the
// database's refusals into clear answers; they never bypass a trigger.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Client = { query: (text: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount?: number | null }>; release: () => void };
type Pool = { connect: () => Promise<Client> };

export const REPLACEMENT_REASON_CODES = [
  'INVALID_CONTACT', 'INCORRECT_INDIVIDUAL', 'NO_GENUINE_INTEREST', 'INCORRECT_SERVICE',
  'DUPLICATE', 'UNREACHABLE_DOCUMENTED', 'INACCURATE_DETAILS', 'OTHER',
  // Booked appointments only (2026-11-26); the database requires the matching outcome to have
  // been recorded on the appointment first.
  'HOMEOWNER_NO_SHOW', 'APPOINTMENT_CANCELLED_BY_HOMEOWNER',
] as const;
export type ReplacementReasonCode = (typeof REPLACEMENT_REASON_CODES)[number];

export class LedgerError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

// The refund for unused credits is always the package's own price per credit times the credits
// refunded, rounded to pence -- the same calculation the database enforces.
export function unusedCreditRefundAmount(amountPaid: number | string, leadsIncluded: number, credits: number): number {
  return Math.round((Number(amountPaid) * credits * 100) / leadsIncluded) / 100;
}

// Whole days between delivery and the buyer's report, for the claim-window column in the admin
// queue. Informational only: whether a late claim is accepted is an admin decision under the
// applicable policy, so nothing is refused on this number.
export function daysAfterDelivery(deliveredAt: Date | string, reportedAt: Date | string): number {
  return Math.floor((new Date(reportedAt).getTime() - new Date(deliveredAt).getTime()) / 86_400_000);
}

function businessError(err: unknown): LedgerError | null {
  const message = err instanceof Error ? err.message : '';
  const code = (err as { code?: string }).code;
  if (code === '23505') return new LedgerError('This conflicts with an existing record (for example a duplicate claim or Tide reference) and was not saved.', 409);
  if (code === '23514') return new LedgerError('This would take the credit balance below zero or break a ledger rule, so it was not saved.', 409);
  if (code === 'P0001' && message) return new LedgerError(message, 409);
  return null;
}

async function inTransaction<T>(pool: Pool, work: (client: Client) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    if (err instanceof LedgerError) throw err;
    const mapped = businessError(err);
    if (mapped) throw mapped;
    throw err;
  } finally {
    client.release();
  }
}

async function audit(client: Client, actor: string, action: string, entityType: string, entityId: number, newState: unknown, previous?: unknown) {
  await client.query(
    `INSERT INTO audit_log (actor, action, entity_type, entity_id, previous_state, new_state) VALUES ($1, $2, $3, $4, $5, $6)`,
    [actor, action, entityType, entityId, previous === undefined ? null : JSON.stringify(previous), JSON.stringify(newState)]
  );
}

// Records a buyer's replacement claim against a delivered lead, identified by its allocation.
export async function recordReplacementRequest(pool: Pool, actor: string, input: {
  leadAllocationId: number;
  reasonCode: ReplacementReasonCode;
  reason: string;
  reportedAt: string;
  documentedContactAttempts?: unknown[];
}) {
  if (!REPLACEMENT_REASON_CODES.includes(input.reasonCode)) throw new LedgerError('Unknown reason code.', 400);
  if (!input.reason?.trim()) throw new LedgerError('A reason is required.', 400);
  if (!input.reportedAt || Number.isNaN(Date.parse(input.reportedAt))) throw new LedgerError('reported_at must be a date and time.', 400);
  return inTransaction(pool, async (client) => {
    const d = await client.query(
      `SELECT d.id, d.delivered_at, la.buyer_id FROM deliveries d JOIN lead_allocations la ON la.id = d.lead_allocation_id
        WHERE d.lead_allocation_id = $1`,
      [input.leadAllocationId]
    );
    if (d.rows.length === 0 || !d.rows[0].delivered_at) throw new LedgerError('That lead has not been delivered, so there is nothing to replace.', 409);
    const delivery = d.rows[0];
    const inserted = await client.query(
      `INSERT INTO replacement_requests (delivery_id, requested_by_buyer_id, reason, reason_code, reported_at, recorded_by, documented_contact_attempts)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [delivery.id, delivery.buyer_id, input.reason.trim(), input.reasonCode, input.reportedAt, actor,
        JSON.stringify(input.documentedContactAttempts ?? [])]
    );
    const id = inserted.rows[0].id as number;
    await audit(client, actor, 'REPLACEMENT_REQUESTED', 'replacement_request', id, {
      lead_allocation_id: input.leadAllocationId, delivery_id: delivery.id, reason_code: input.reasonCode,
      reported_at: input.reportedAt, days_after_delivery: daysAfterDelivery(delivery.delivered_at, input.reportedAt),
    });
    return { id };
  });
}

// Approves or denies a claim, once.
export async function decideReplacementRequest(pool: Pool, actor: string, id: number, decision: 'APPROVED' | 'DENIED', notes?: string) {
  if (decision !== 'APPROVED' && decision !== 'DENIED') throw new LedgerError("decision must be 'APPROVED' or 'DENIED'.", 400);
  return inTransaction(pool, async (client) => {
    const before = await client.query(`SELECT status FROM replacement_requests WHERE id = $1 FOR UPDATE`, [id]);
    if (before.rows.length === 0) throw new LedgerError('No such replacement request.', 404);
    if (before.rows[0].status !== 'PENDING_ADMIN_REVIEW') throw new LedgerError(`This request has already been decided (${before.rows[0].status}).`, 409);
    await client.query(
      `UPDATE replacement_requests SET status = $2, decided_by = $3, decided_at = now(), admin_decision_notes = $4 WHERE id = $1`,
      [id, decision, actor, notes?.trim() || null]
    );
    await audit(client, actor, decision === 'APPROVED' ? 'REPLACEMENT_APPROVED' : 'REPLACEMENT_DENIED', 'replacement_request', id,
      { status: decision, notes: notes ?? null }, { status: 'PENDING_ADMIN_REVIEW' });
    return { id, status: decision };
  });
}

// Resolves an approved claim by restoring the package credit (package lead) or recording the 9.4
// refund (no replacement within 30 days). A pay-per-lead replacement lead is supplied through the
// allocate route instead (replacement_request_id), which resolves the claim in its own transaction.
export async function resolveReplacementRequest(pool: Pool, actor: string, id: number, input: {
  resolution: 'CREDIT_RESTORED' | 'REFUNDED';
  refundTransactionReference?: string;
  refundedAt?: string;
}) {
  if (input.resolution !== 'CREDIT_RESTORED' && input.resolution !== 'REFUNDED') {
    throw new LedgerError("resolution must be 'CREDIT_RESTORED' or 'REFUNDED'. A replacement lead is supplied from the allocate screen.", 400);
  }
  return inTransaction(pool, async (client) => {
    const r = await client.query(
      `SELECT r.id, r.status, r.resolution, la.id AS allocation_id, la.package_id, la.agreed_price,
              round(bp.amount_paid / bp.leads_included, 2) AS package_price_per_credit
         FROM replacement_requests r
         JOIN deliveries d ON d.id = r.delivery_id
         JOIN lead_allocations la ON la.id = d.lead_allocation_id
         LEFT JOIN buyer_packages bp ON bp.id = la.package_id
        WHERE r.id = $1
        FOR UPDATE OF r`,
      [id]
    );
    if (r.rows.length === 0) throw new LedgerError('No such replacement request.', 404);
    const req = r.rows[0];
    if (req.status !== 'APPROVED') throw new LedgerError('Only an approved request can be resolved.', 409);
    if (req.resolution) throw new LedgerError(`This request is already resolved (${req.resolution}).`, 409);

    if (input.resolution === 'CREDIT_RESTORED') {
      if (!req.package_id) throw new LedgerError('This lead was paid per lead, not from a package: supply a free replacement lead or refund it.', 409);
      await client.query(
        `UPDATE replacement_requests SET resolution = 'CREDIT_RESTORED', resolved_by = $2, resolved_at = now() WHERE id = $1`,
        [id, actor]
      );
      await audit(client, actor, 'PACKAGE_CREDIT_RESTORED', 'replacement_request', id, { buyer_package_id: req.package_id, allocation_id: req.allocation_id });
      return { id, resolution: 'CREDIT_RESTORED', buyer_package_id: req.package_id as number };
    }

    if (!input.refundTransactionReference?.trim()) throw new LedgerError('The Tide reference of the refund is required.', 400);
    if (!input.refundedAt || Number.isNaN(Date.parse(input.refundedAt))) throw new LedgerError('refunded_at must be a date and time.', 400);
    // Calculated by the database (exact NUMERIC rounding), the same figure its trigger checks.
    const amount = req.package_id
      ? Number(req.package_price_per_credit)
      : req.agreed_price === null ? null : Number(req.agreed_price);
    if (amount === null) throw new LedgerError('The price paid for this lead is not recorded, so the refund cannot be recorded here.', 409);
    await client.query(
      `UPDATE replacement_requests SET resolution = 'REFUNDED', resolved_by = $2, resolved_at = now(),
              refund_amount = $3, refund_transaction_reference = $4, refunded_at = $5
        WHERE id = $1`,
      [id, actor, amount, input.refundTransactionReference.trim(), input.refundedAt]
    );
    await audit(client, actor, 'REPLACEMENT_REFUNDED', 'replacement_request', id, {
      amount, refund_transaction_reference: input.refundTransactionReference.trim(), refunded_at: input.refundedAt,
      allocation_id: req.allocation_id, buyer_package_id: req.package_id ?? null,
    });
    return { id, resolution: 'REFUNDED', amount };
  });
}

// Records a manual Tide refund of unused package credits (buyer stopped, or credits expired). The
// amount is always calculated here from the package itself, never typed in.
export async function recordPackageRefund(pool: Pool, actor: string, input: {
  buyerPackageId: number;
  credits: number;
  reason: 'BUYER_STOPPED' | 'CREDITS_EXPIRED';
  transactionReference: string;
  refundedAt: string;
  notes?: string;
}) {
  if (!Number.isInteger(input.credits) || input.credits <= 0) throw new LedgerError('credits must be a whole number above zero.', 400);
  if (input.reason !== 'BUYER_STOPPED' && input.reason !== 'CREDITS_EXPIRED') throw new LedgerError("reason must be 'BUYER_STOPPED' or 'CREDITS_EXPIRED'.", 400);
  if (!input.transactionReference?.trim()) throw new LedgerError('The Tide reference of the refund is required.', 400);
  if (!input.refundedAt || Number.isNaN(Date.parse(input.refundedAt))) throw new LedgerError('refunded_at must be a date and time.', 400);
  return inTransaction(pool, async (client) => {
    // The amount is calculated by the database (exact NUMERIC rounding), the same figure its
    // trigger checks, so the record and the check can never disagree on a penny.
    const p = await client.query(
      `SELECT id, currency, leads_used, credits_refunded, round(amount_paid * $2 / leads_included, 2) AS refund_amount
         FROM buyer_packages WHERE id = $1 FOR UPDATE`,
      [input.buyerPackageId, input.credits]
    );
    if (p.rows.length === 0) throw new LedgerError('No such package.', 404);
    const pkg = p.rows[0];
    const amount = Number(pkg.refund_amount);
    const inserted = await client.query(
      `INSERT INTO package_refunds (buyer_package_id, credits_refunded, amount, currency, reason, transaction_reference, refunded_at, recorded_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [pkg.id, input.credits, pkg.refund_amount, pkg.currency, input.reason, input.transactionReference.trim(), input.refundedAt, actor, input.notes?.trim() || null]
    );
    const id = inserted.rows[0].id as number;
    await audit(client, actor, 'PACKAGE_CREDITS_REFUNDED', 'buyer_package', pkg.id, {
      package_refund_id: id, credits: input.credits, amount, reason: input.reason,
      transaction_reference: input.transactionReference.trim(), refunded_at: input.refundedAt,
    }, { leads_used: pkg.leads_used, credits_refunded: pkg.credits_refunded });
    return { id, amount };
  });
}

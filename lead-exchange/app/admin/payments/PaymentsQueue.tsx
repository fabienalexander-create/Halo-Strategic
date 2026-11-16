'use client';

import { useEffect, useState } from 'react';
import { apiPath } from '../../../lib/basePath';

interface PaymentRow {
  id: number;
  status: string;
  expected_amount: number;
  amount_received: number | null;
  currency: string;
  payment_link: string | null;
  payment_reference: string | null;
  transaction_reference: string | null;
  lead_id: number;
  buyer_company_name: string;
  created_at: string;
}

const STATUSES = ['All', 'PENDING', 'PAID', 'SETTLED', 'UNDER_REVIEW', 'FAILED', 'REFUNDED', 'DISPUTED'] as const;

export default function PaymentsQueue() {
  const [payments, setPayments] = useState<PaymentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<(typeof STATUSES)[number]>('PENDING');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  function load() {
    const query = statusFilter === 'All' ? '' : `?status=${statusFilter}`;
    setPayments(null);
    fetch(apiPath(`/api/admin/payments${query}`))
      .then(async (r) => { if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to load.'); return r.json(); })
      .then((data) => setPayments(data.payments))
      .catch((e) => setError(e.message));
  }

  useEffect(() => { load(); }, [statusFilter]);

  if (error) return <div className="disclaimer-box">{error}</div>;

  return (
    <div>
      <p className="form-note" style={{ marginBottom: 16 }}>
        Tide is checked by you, by hand, before marking anything verified here. Nothing in this
        system verifies a payment on its own -- it only records what you've already confirmed.
      </p>
      <div className="form-row" style={{ maxWidth: 240, marginBottom: 16 }}>
        <label htmlFor="status-filter">Filter by status</label>
        <select id="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as (typeof STATUSES)[number])}>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {!payments ? <p>Loading&hellip;</p> : payments.length === 0 ? <p>No payments match this filter.</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: '10px 8px' }}>Payment</th>
              <th style={{ padding: '10px 8px' }}>Buyer</th>
              <th style={{ padding: '10px 8px' }}>Expected</th>
              <th style={{ padding: '10px 8px' }}>Status</th>
              <th style={{ padding: '10px 8px' }}></th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <PaymentRowItem key={p.id} payment={p} expanded={expandedId === p.id} onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)} onChanged={load} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PaymentRowItem({ payment, expanded, onToggle, onChanged }: { payment: PaymentRow; expanded: boolean; onToggle: () => void; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [transactionReference, setTransactionReference] = useState('');
  const [amountReceived, setAmountReceived] = useState(String(payment.expected_amount));

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(apiPath(`/api/admin/payments/${payment.id}/verify`), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transaction_reference: transactionReference, amount_received: Number(amountReceived) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to verify payment.');
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <tr style={{ borderBottom: '1px solid var(--border)' }}>
        <td style={{ padding: '10px 8px' }}>
          {payment.payment_reference}
          <div style={{ color: 'var(--slate)', fontSize: '0.8rem' }}>
            HLX-LEAD-{String(payment.lead_id).padStart(6, '0')}
            {payment.payment_link && <><br /><a href={payment.payment_link} target="_blank" rel="noreferrer">{payment.payment_link}</a></>}
          </div>
        </td>
        <td style={{ padding: '10px 8px' }}>{payment.buyer_company_name}</td>
        <td style={{ padding: '10px 8px' }}>{payment.currency} {payment.expected_amount.toFixed(2)}</td>
        <td style={{ padding: '10px 8px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.78rem' }}>{payment.status}</td>
        <td style={{ padding: '10px 8px' }}>
          {payment.status === 'PENDING' && (
            <button className="btn btn-bronze" onClick={onToggle} style={{ fontSize: '0.82rem', padding: '6px 12px' }}>
              {expanded ? 'Close' : 'I checked Tide'}
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} style={{ padding: '14px 8px', background: 'var(--off-white, #faf9f7)' }}>
            {error && <div className="disclaimer-box" style={{ marginBottom: 12 }}>{error}</div>}
            <form onSubmit={verify}>
              <div className="form-row">
                <label>Tide transaction reference (what you actually saw)</label>
                <input value={transactionReference} onChange={(e) => setTransactionReference(e.target.value)} required />
              </div>
              <div className="form-row">
                <label>Amount received</label>
                <input type="number" step="0.01" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} required />
              </div>
              <button className="btn btn-bronze" type="submit" disabled={submitting || !transactionReference}>
                Mark paid &amp; release details
              </button>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

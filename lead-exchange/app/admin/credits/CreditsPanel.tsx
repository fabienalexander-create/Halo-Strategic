'use client';

import { useEffect, useState } from 'react';
import { apiPath } from '../../../lib/basePath';

// Package credit balances (with REFUND_DUE), the replacement queue, and the forms that record a
// claim, decide it, resolve it and record manual Tide refunds. Every rule is enforced server-side
// and in the database; this screen only collects input and shows the result.

interface PackageRow {
  buyer_package_id: number;
  company_name: string;
  package_name: string | null;
  amount_paid: string;
  currency: string;
  leads_included: number;
  leads_used: number;
  credits_restored: number;
  credits_refunded: number;
  credits_remaining: number;
  price_per_credit: string;
  verified_at: string;
  expires_at: string | null;
  balance_status: 'ACTIVE' | 'USED_UP' | 'REFUND_DUE';
  refund_due_amount: string | null;
}

interface RefundRow {
  id: number;
  buyer_package_id: number;
  credits_refunded: number;
  amount: string;
  reason: string;
  transaction_reference: string;
  refunded_at: string;
}

interface RequestRow {
  id: number;
  status: string;
  reason_code: string | null;
  reason: string;
  reported_at: string | null;
  days_after_delivery: number | null;
  lead_allocation_id: number;
  lead_id: number;
  package_id: number | null;
  agreed_price: string | null;
  company_name: string;
  resolution: string | null;
  replacement_allocation_id: number | null;
  refund_amount: string | null;
  admin_decision_notes: string | null;
}

const REASONS = ['INVALID_CONTACT', 'INCORRECT_INDIVIDUAL', 'NO_GENUINE_INTEREST', 'INCORRECT_SERVICE', 'DUPLICATE', 'UNREACHABLE_DOCUMENTED', 'INACCURATE_DETAILS', 'OTHER'];
const leadRef = (id: number) => `HLX-LEAD-${String(id).padStart(6, '0')}`;
const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString('en-GB') : 'No expiry');
const cell = { padding: '8px 6px', verticalAlign: 'top' as const };

async function post(path: string, body: unknown) {
  const res = await fetch(apiPath(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Request failed.');
  return data;
}

export default function CreditsPanel() {
  const [packages, setPackages] = useState<PackageRow[] | null>(null);
  const [refunds, setRefunds] = useState<RefundRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function load() {
    setError(null);
    Promise.all([
      fetch(apiPath('/api/admin/package-balances')).then(async (r) => { if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to load balances.'); return r.json(); }),
      fetch(apiPath('/api/admin/replacement-requests')).then(async (r) => { if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to load requests.'); return r.json(); }),
    ])
      .then(([b, q]) => { setPackages(b.packages); setRefunds(b.refunds); setRequests(q.requests); })
      .catch((e) => setError(e.message));
  }
  useEffect(() => { load(); }, []);

  async function act(fn: () => Promise<unknown>, done: string) {
    setError(null); setNotice(null);
    try { await fn(); setNotice(done); load(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  return (
    <div>
      {error && <div className="disclaimer-box" role="alert" style={{ marginBottom: 16 }}>{error}</div>}
      {notice && <div className="form-note" role="status" style={{ marginBottom: 16, color: 'var(--navy)' }}>{notice}</div>}

      <h2 style={{ fontSize: '1.2rem', margin: '8px 0 10px' }}>Package credit balances</h2>
      <p className="form-note" style={{ marginBottom: 12 }}>
        Refund due means the package has expired with credits unused. Pay the refund through Tide first, then record it
        here with the Tide reference. The amount is calculated from the package for you. Packages recorded before the
        credits ledger have no expiry.
      </p>
      {!packages ? <p>Loading&hellip;</p> : packages.length === 0 ? <p>No packages recorded.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                <th style={cell}>Package</th><th style={cell}>Buyer</th><th style={cell}>Credits</th>
                <th style={cell}>Expires</th><th style={cell}>Status</th><th style={cell}>Record refund</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((p) => (
                <tr key={p.buyer_package_id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={cell}>#{p.buyer_package_id} {p.package_name ?? 'Ad hoc'}<div style={{ color: 'var(--slate)' }}>£{p.amount_paid} for {p.leads_included} (£{p.price_per_credit} each)</div></td>
                  <td style={cell}>{p.company_name}</td>
                  <td style={cell}>
                    <strong>{p.credits_remaining} left</strong>
                    <div style={{ color: 'var(--slate)' }}>{p.leads_used} used &middot; {p.credits_restored} restored &middot; {p.credits_refunded} refunded</div>
                  </td>
                  <td style={cell}>{fmtDate(p.expires_at)}</td>
                  <td style={cell}>
                    <span style={{ fontWeight: 600, color: p.balance_status === 'REFUND_DUE' ? '#8C4438' : 'var(--navy)' }}>
                      {p.balance_status === 'REFUND_DUE' ? `Refund due: £${p.refund_due_amount}` : p.balance_status === 'USED_UP' ? 'Used up' : 'Active'}
                    </span>
                  </td>
                  <td style={cell}>{p.credits_remaining > 0 && <RefundForm pkg={p} onDone={(msg) => act(async () => undefined, msg)} onError={setError} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {refunds.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary>Recorded refunds ({refunds.length})</summary>
          <ul style={{ fontSize: '0.88rem', color: 'var(--slate)' }}>
            {refunds.map((r) => (
              <li key={r.id}>Package #{r.buyer_package_id}: {r.credits_refunded} credit(s), £{r.amount}, {r.reason === 'CREDITS_EXPIRED' ? 'expired' : 'buyer stopped'}, Tide {r.transaction_reference}, {new Date(r.refunded_at).toLocaleDateString('en-GB')}</li>
            ))}
          </ul>
        </details>
      )}

      <h2 style={{ fontSize: '1.2rem', margin: '32px 0 10px' }}>Replacement requests</h2>
      <NewRequestForm onDone={(id) => act(async () => undefined, `Replacement request #${id} recorded.`)} onError={setError} />
      {!requests ? <p>Loading&hellip;</p> : requests.length === 0 ? <p>No replacement requests yet.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                <th style={cell}>Request</th><th style={cell}>Lead</th><th style={cell}>Reason</th>
                <th style={cell}>Reported</th><th style={cell}>Status</th><th style={cell}>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={cell}>#{r.id}<div style={{ color: 'var(--slate)' }}>{r.company_name}</div></td>
                  <td style={cell}>{leadRef(r.lead_id)}<div style={{ color: 'var(--slate)' }}>{r.package_id ? `Package #${r.package_id}` : `Pay per lead, £${r.agreed_price ?? '?'}`}</div></td>
                  <td style={cell}>{r.reason_code ?? 'Legacy'}<div style={{ color: 'var(--slate)' }}>{r.reason}</div></td>
                  <td style={cell}>{r.reported_at ? new Date(r.reported_at).toLocaleDateString('en-GB') : '—'}{r.days_after_delivery !== null && <div style={{ color: 'var(--slate)' }}>{r.days_after_delivery} day(s) after delivery</div>}</td>
                  <td style={cell}>{r.status}{r.resolution && <div style={{ color: 'var(--slate)' }}>{r.resolution}{r.refund_amount ? ` £${r.refund_amount}` : ''}{r.replacement_allocation_id ? ` (allocation #${r.replacement_allocation_id})` : ''}</div>}</td>
                  <td style={cell}>
                    {r.status === 'PENDING_ADMIN_REVIEW' && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-bronze" onClick={() => act(() => post(`/api/admin/replacement-requests/${r.id}/decision`, { decision: 'APPROVED' }), `Request #${r.id} approved.`)}>Approve</button>
                        <button type="button" className="btn" onClick={() => { const notes = window.prompt('Reason for denying (recorded):') ?? undefined; act(() => post(`/api/admin/replacement-requests/${r.id}/decision`, { decision: 'DENIED', notes }), `Request #${r.id} denied.`); }}>Deny</button>
                      </div>
                    )}
                    {r.status === 'APPROVED' && !r.resolution && (
                      r.package_id ? (
                        <button type="button" className="btn btn-bronze" onClick={() => act(() => post(`/api/admin/replacement-requests/${r.id}/resolve`, { resolution: 'CREDIT_RESTORED' }), `Credit restored to package #${r.package_id}.`)}>Restore credit</button>
                      ) : (
                        <p className="form-note" style={{ margin: 0 }}>Supply a free lead from Leads (allocate with request #{r.id}), or after 30 days without one:</p>
                      )
                    )}
                    {r.status === 'APPROVED' && !r.resolution && <ReplacementRefundForm id={r.id} onDone={(msg) => act(async () => undefined, msg)} onError={setError} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RefundForm({ pkg, onDone, onError }: { pkg: PackageRow; onDone: (msg: string) => void; onError: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [credits, setCredits] = useState(String(pkg.credits_remaining));
  const [reason, setReason] = useState(pkg.balance_status === 'REFUND_DUE' ? 'CREDITS_EXPIRED' : 'BUYER_STOPPED');
  const [ref, setRef] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  if (!open) return <button type="button" className="btn" onClick={() => setOpen(true)}>Record refund</button>;
  const amount = Math.round((Number(pkg.amount_paid) * Number(credits || 0) * 100) / pkg.leads_included) / 100;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      await post('/api/admin/package-refunds', { buyer_package_id: pkg.buyer_package_id, credits: Number(credits), reason, transaction_reference: ref, refunded_at: new Date(date).toISOString() });
      setOpen(false); onDone(`Refund of £${amount.toFixed(2)} recorded for package #${pkg.buyer_package_id}.`);
    } catch (err) { onError(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 6, minWidth: 220 }}>
      <label>Credits <input type="number" min={1} max={pkg.credits_remaining} value={credits} onChange={(e) => setCredits(e.target.value)} required /></label>
      <label>Reason
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          <option value="BUYER_STOPPED">Buyer stopped</option>
          <option value="CREDITS_EXPIRED">Credits expired</option>
        </select>
      </label>
      <label>Tide reference <input value={ref} onChange={(e) => setRef(e.target.value)} required /></label>
      <label>Refunded on <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
      <p className="form-note" style={{ margin: 0 }}>Amount: £{amount.toFixed(2)} (calculated)</p>
      <button className="btn btn-bronze" type="submit" disabled={busy}>Save refund</button>
    </form>
  );
}

function ReplacementRefundForm({ id, onDone, onError }: { id: number; onDone: (msg: string) => void; onError: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [ref, setRef] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  if (!open) return <button type="button" className="btn" style={{ marginTop: 6 }} onClick={() => setOpen(true)}>Record 9.4 refund</button>;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const data = await post(`/api/admin/replacement-requests/${id}/resolve`, { resolution: 'REFUNDED', refund_transaction_reference: ref, refunded_at: new Date(date).toISOString() });
      setOpen(false); onDone(`Refund of £${Number(data.amount).toFixed(2)} recorded for request #${id}.`);
    } catch (err) { onError(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 6, minWidth: 220, marginTop: 6 }}>
      <label>Tide reference <input value={ref} onChange={(e) => setRef(e.target.value)} required /></label>
      <label>Refunded on <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
      <p className="form-note" style={{ margin: 0 }}>The amount is the price paid for the lead, calculated for you.</p>
      <button className="btn btn-bronze" type="submit" disabled={busy}>Save refund</button>
    </form>
  );
}

function NewRequestForm({ onDone, onError }: { onDone: (id: number) => void; onError: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [allocationId, setAllocationId] = useState('');
  const [reasonCode, setReasonCode] = useState(REASONS[0]);
  const [reason, setReason] = useState('');
  const [reportedAt, setReportedAt] = useState(new Date().toISOString().slice(0, 16));
  const [busy, setBusy] = useState(false);
  if (!open) return <p><button type="button" className="btn btn-bronze" onClick={() => setOpen(true)}>Record a replacement request</button></p>;
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const data = await post('/api/admin/replacement-requests', { lead_allocation_id: Number(allocationId), reason_code: reasonCode, reason, reported_at: new Date(reportedAt).toISOString() });
      setOpen(false); setAllocationId(''); setReason(''); onDone(data.id);
    } catch (err) { onError(err instanceof Error ? err.message : String(err)); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 8, maxWidth: 420, marginBottom: 16 }}>
      <label>Allocation ID of the delivered lead <input inputMode="numeric" value={allocationId} onChange={(e) => setAllocationId(e.target.value.replace(/\D/g, ''))} required /></label>
      <label>Reason
        <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
          {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <label>What the buyer reported <textarea value={reason} onChange={(e) => setReason(e.target.value)} required rows={3} /></label>
      <label>When the buyer reported it <input type="datetime-local" value={reportedAt} onChange={(e) => setReportedAt(e.target.value)} required /></label>
      <button className="btn btn-bronze" type="submit" disabled={busy}>Save request</button>
    </form>
  );
}

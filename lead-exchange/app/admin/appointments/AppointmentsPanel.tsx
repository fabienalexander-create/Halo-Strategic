'use client';

import { useEffect, useState } from 'react';
import { apiPath } from '../../../lib/basePath';

// Booked appointments (2026-11-26). Halo records the agreed date and time when allocating the lead
// (Leads page); this page records what happened afterwards, and sets each buyer's agreed price per
// appointment. The database enforces every rule; buttons that would be refused are hidden.

interface AppointmentRow {
  id: number;
  lead_allocation_id: number;
  scheduled_at: string;
  appointment_kind: 'IN_PERSON' | 'PHONE' | 'VIDEO';
  location_notes: string | null;
  homeowner_confirmed_at: string;
  arranged_by: string;
  status: string;
  outcome_notes: string | null;
  lead_id: number;
  company_name: string;
  postcode: string;
  delivered: boolean;
  history: { event: string; scheduled_at: string; notes: string | null; actor: string; at: string }[] | null;
}

interface BuyerRow {
  id: number;
  company_name: string;
  application_reference: string;
  agreed_price_per_appointment: number | string | null;
}

const KIND: Record<AppointmentRow['appointment_kind'], string> = { IN_PERSON: 'In person', PHONE: 'Phone', VIDEO: 'Video' };
const STATUS_LABEL: Record<string, string> = {
  BOOKED: 'Booked', RESCHEDULED: 'Rescheduled', CANCELLED_BY_HOMEOWNER: 'Cancelled by homeowner',
  HOMEOWNER_NO_SHOW: 'Homeowner did not attend', CANCELLED_BY_BUYER: 'Cancelled by buyer', COMPLETED: 'Completed',
};
const ukTime = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const cell: React.CSSProperties = { padding: '8px 6px', verticalAlign: 'top', borderBottom: '1px solid var(--border)' };

async function post(path: string, body: unknown) {
  const res = await fetch(apiPath(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Request failed.');
  return data;
}

export default function AppointmentsPanel() {
  const [rows, setRows] = useState<AppointmentRow[] | null>(null);
  const [buyers, setBuyers] = useState<BuyerRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    fetch(apiPath('/api/admin/appointments'))
      .then(async (r) => { if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to load appointments.'); return r.json(); })
      .then((d) => setRows(d.appointments))
      .catch((e) => setError(e.message));
    fetch(apiPath('/api/admin/buyers?status=ACTIVE'))
      .then(async (r) => { if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to load buyers.'); return r.json(); })
      .then((d) => setBuyers(d.buyers))
      .catch((e) => setError(e.message));
  }
  useEffect(() => { load(); }, []);

  async function act(fn: () => Promise<unknown>, done: string) {
    setBusy(true); setError(null); setNotice(null);
    try { await fn(); setNotice(done); load(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  function record(r: AppointmentRow, status: string) {
    if (status === 'RESCHEDULED') {
      const when = window.prompt('New date and time agreed with the homeowner (UK time, YYYY-MM-DD HH:MM):');
      if (!when) return;
      const t = new Date(when.replace(' ', 'T'));
      if (Number.isNaN(t.getTime())) { setError('That date and time was not recognised.'); return; }
      const notes = window.prompt('Notes (optional, recorded):') ?? undefined;
      act(() => post(`/api/admin/appointments/${r.id}/status`, { status, scheduled_at: t.toISOString(), outcome_notes: notes }), `Appointment #${r.id} rescheduled.`);
      return;
    }
    const notes = window.prompt(`${STATUS_LABEL[status]}: notes (recorded; this cannot be undone):`);
    if (notes === null) return;
    act(() => post(`/api/admin/appointments/${r.id}/status`, { status, outcome_notes: notes || undefined }), `Appointment #${r.id}: ${STATUS_LABEL[status]}.`);
  }

  return (
    <div>
      {error && <div className="disclaimer-box" style={{ marginBottom: 12 }}>{error}</div>}
      {notice && <div className="form-note" style={{ marginBottom: 12, color: '#2f4a33' }}>{notice}</div>}

      <p className="form-note">
        A no-show or a homeowner cancellation that can&rsquo;t be rearranged is recorded here first. The
        buyer&rsquo;s claim is then logged on Credits &amp; Replacements (reason &ldquo;Homeowner no-show&rdquo; or
        &ldquo;Appointment cancelled by homeowner&rdquo;) and handled like any other replacement.
      </p>

      {!rows ? <p>Loading&hellip;</p> : rows.length === 0 ? <p>No booked appointments yet.</p> : (
        <div style={{ overflowX: 'auto', marginBottom: 32 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                <th style={cell}>Appointment</th><th style={cell}>Lead / buyer</th><th style={cell}>Status</th><th style={cell}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const live = r.status === 'BOOKED' || r.status === 'RESCHEDULED';
                const passed = new Date(r.scheduled_at).getTime() <= Date.now();
                return (
                  <tr key={r.id}>
                    <td style={cell}>
                      <strong>{ukTime(r.scheduled_at)}</strong>
                      <div style={{ color: 'var(--slate)' }}>{KIND[r.appointment_kind]}{r.location_notes ? ` · ${r.location_notes}` : ''}</div>
                      <div style={{ color: 'var(--slate)', fontSize: '0.78rem' }}>
                        #{r.id} · agreed by homeowner {ukTime(r.homeowner_confirmed_at)} · arranged by {r.arranged_by}
                      </div>
                    </td>
                    <td style={cell}>
                      HLX-LEAD-{String(r.lead_id).padStart(6, '0')} · {r.postcode}
                      <div>{r.company_name}</div>
                      <div style={{ color: 'var(--slate)', fontSize: '0.78rem' }}>{r.delivered ? 'Details delivered' : 'Awaiting payment / release'}</div>
                    </td>
                    <td style={cell}>
                      {STATUS_LABEL[r.status] ?? r.status}
                      {r.outcome_notes && <div style={{ color: 'var(--slate)' }}>{r.outcome_notes}</div>}
                      {r.history && r.history.length > 1 && (
                        <details style={{ marginTop: 4 }}>
                          <summary style={{ cursor: 'pointer', fontSize: '0.78rem' }}>History</summary>
                          <ul style={{ margin: '4px 0 0 16px', fontSize: '0.78rem' }}>
                            {r.history.map((h, i) => <li key={i}>{STATUS_LABEL[h.event] ?? h.event}: {ukTime(h.scheduled_at)} ({h.actor}, {ukTime(h.at)})</li>)}
                          </ul>
                        </details>
                      )}
                    </td>
                    <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                      {live && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {!passed && <button type="button" className="btn" disabled={busy} onClick={() => record(r, 'RESCHEDULED')}>Reschedule</button>}
                          <button type="button" className="btn" disabled={busy} onClick={() => record(r, 'CANCELLED_BY_HOMEOWNER')}>Homeowner cancelled</button>
                          <button type="button" className="btn" disabled={busy} onClick={() => record(r, 'CANCELLED_BY_BUYER')}>Buyer cancelled</button>
                          {passed && <button type="button" className="btn" disabled={busy} onClick={() => record(r, 'HOMEOWNER_NO_SHOW')}>Homeowner didn&rsquo;t attend</button>}
                          {passed && <button type="button" className="btn btn-bronze" disabled={busy} onClick={() => record(r, 'COMPLETED')}>Completed</button>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={{ fontSize: '1.15rem', marginBottom: 8 }}>Agreed price per booked appointment</h2>
      <p className="form-note">
        Owner only. Applies to future pay-per-appointment allocations; anything already allocated keeps
        the price recorded at the time. Leave a buyer blank if appointments haven&rsquo;t been agreed with them.
      </p>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
        <tbody>
          {buyers.map((b) => <PriceRow key={b.id} buyer={b} busy={busy} onSave={(price) => act(
            () => post(`/api/admin/buyers/${encodeURIComponent(b.application_reference)}/appointment-price`, { agreed_price_per_appointment: price }),
            `${b.company_name}: price per appointment ${price === null ? 'cleared' : `set to £${price.toFixed(2)}`}.`,
          )} />)}
        </tbody>
      </table>
    </div>
  );
}

function PriceRow({ buyer, busy, onSave }: { buyer: BuyerRow; busy: boolean; onSave: (price: number | null) => void }) {
  const [value, setValue] = useState(buyer.agreed_price_per_appointment === null ? '' : String(Number(buyer.agreed_price_per_appointment)));
  return (
    <tr>
      <td style={cell}>{buyer.company_name}</td>
      <td style={cell}>
        £ <input value={value} inputMode="decimal" onChange={(e) => setValue(e.target.value)} style={{ width: 90 }} placeholder="not set" />
      </td>
      <td style={cell}>
        <button type="button" className="btn" disabled={busy} onClick={() => onSave(value.trim() === '' ? null : Number(value))}>Save</button>
      </td>
    </tr>
  );
}

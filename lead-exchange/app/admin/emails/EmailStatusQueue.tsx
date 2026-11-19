'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiPath } from '../../../lib/basePath';

interface EmailRow {
  kind: 'application' | 'lead';
  id: number;
  email_type: string;
  recipient: string;
  status: string;
  error_message: string | null;
  attempt_count: number;
  sent_at: string | null;
  delivered_at: string | null;
  bounced_at: string | null;
  last_event: string | null;
  last_event_at: string | null;
  outcome_unknown: boolean;
  send_claimed_at: string | null;
  superseded_reason: string | null;
  created_at: string;
  reference: string;
  company_name: string;
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#B08D57',
  SENT: '#1B2A4A',
  DELIVERED: '#2f4a33',
  FAILED: '#8C4438',
  BOUNCED: '#8C4438',
  COMPLAINED: '#8C4438',
  SUPERSEDED: '#7a7a7a',
};

const FILTERS = ['All', 'FAILED', 'BOUNCED', 'COMPLAINED', 'PENDING', 'SENT', 'DELIVERED', 'SUPERSEDED'] as const;

const TYPE_LABEL: Record<string, string> = {
  APPLICATION_RECEIVED: 'Application received',
  APPLICATION_APPROVED_FOR_COMMERCIAL_REVIEW: 'Application approved',
  ADMIN_NEW_APPLICATION: 'New application (admin)',
  LEAD_OFFER: 'Lead offer',
  LEAD_UNLOCKED: 'Lead unlocked',
  INTERNAL_OFFER_COPY: 'Offer copy (admin)',
  INTERNAL_RELEASE_COPY: 'Release copy (admin)',
};

function when(value: string | null): string {
  return value ? new Date(value).toLocaleString('en-GB') : '-';
}

function detail(r: EmailRow): string {
  if (r.status === 'SUPERSEDED') return r.superseded_reason ?? 'Superseded: will not be sent';
  if (r.outcome_unknown) return 'Outcome unknown: may already have been delivered. Check with the recipient before retrying.';
  if (r.send_claimed_at && (r.status === 'PENDING' || r.status === 'FAILED')) return 'Sending now';
  return r.error_message ?? (r.last_event ? `Last event: ${r.last_event.replace('email.', '')}` : '-');
}

export default function EmailStatusQueue() {
  const [rows, setRows] = useState<EmailRow[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [webhookConfigured, setWebhookConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<(typeof FILTERS)[number]>('All');

  const load = useCallback(() => {
    const query = statusFilter === 'All' ? '' : `?status=${statusFilter}`;
    setRows(null);
    fetch(apiPath(`/api/admin/emails${query}`))
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to load.');
        return r.json();
      })
      .then((data) => {
        setRows(data.emails);
        setCounts(data.counts ?? {});
        setWebhookConfigured(Boolean(data.webhook_configured));
      })
      .catch((e) => setError(e.message));
  }, [statusFilter]);

  useEffect(load, [load]);

  async function retry(r: EmailRow) {
    let confirmed = false;
    if (r.outcome_unknown) {
      confirmed = window.confirm(
        `An earlier attempt to ${r.recipient} may already have arrived. Only continue if you have checked it did not. Send again?`
      );
      if (!confirmed) return;
    }
    const key = `${r.kind}-${r.id}`;
    setBusyId(key);
    setNotice(null);
    const path = r.kind === 'application'
      ? `/api/admin/transactional-emails/${r.id}/retry`
      : `/api/admin/lead-delivery-emails/${r.id}/retry`;
    try {
      const res = await fetch(apiPath(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confirmed ? { confirmed_not_received: true } : {}),
      });
      const data = await res.json();
      if (data.sent) setNotice(`Sent ${TYPE_LABEL[r.email_type] ?? r.email_type} to ${r.recipient}.`);
      else if (data.skipped) setNotice('Not sent: it has already gone out or is being sent right now.');
      else setNotice(`Not sent: ${data.error ?? 'unknown error'}`);
    } catch {
      setNotice('Retry request failed.');
    } finally {
      setBusyId(null);
      load();
    }
  }

  if (error) return <div className="disclaimer-box">{error}</div>;

  return (
    <div>
      {webhookConfigured === false && (
        <div className="disclaimer-box" style={{ marginBottom: 16 }}>
          Delivery tracking is not connected yet (RESEND_WEBHOOK_SECRET is not set). Emails show as
          SENT when Resend accepts them, but delivered, bounced and spam reports will not appear.
        </div>
      )}

      <p style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.8rem', color: 'var(--slate)', marginBottom: 12 }}>
        {['DELIVERED', 'SENT', 'FAILED', 'BOUNCED', 'COMPLAINED', 'PENDING', 'SUPERSEDED']
          .map((s) => `${s} ${counts[s] ?? 0}`)
          .join('  ·  ')}
      </p>

      <div className="form-row" style={{ maxWidth: 280, marginBottom: 16 }}>
        <label htmlFor="status-filter">Filter by status</label>
        <select
          id="status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as (typeof FILTERS)[number])}
        >
          {FILTERS.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      {notice && <div className="disclaimer-box" style={{ marginBottom: 16 }}>{notice}</div>}

      {!rows ? (
        <p>Loading&hellip;</p>
      ) : rows.length === 0 ? (
        <p>No emails match this filter.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '10px 8px' }}>Reference</th>
                <th style={{ padding: '10px 8px' }}>Email</th>
                <th style={{ padding: '10px 8px' }}>Recipient</th>
                <th style={{ padding: '10px 8px' }}>Status</th>
                <th style={{ padding: '10px 8px' }}>Detail</th>
                <th style={{ padding: '10px 8px' }}>Attempts</th>
                <th style={{ padding: '10px 8px' }}>Sent</th>
                <th style={{ padding: '10px 8px' }}>Delivered</th>
                <th style={{ padding: '10px 8px' }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const key = `${r.kind}-${r.id}`;
                const canRetry = (r.status === 'FAILED' || r.status === 'PENDING') && !(r.send_claimed_at && !r.outcome_unknown);
                return (
                  <tr key={key} style={{ borderBottom: '1px solid var(--border)', opacity: r.status === 'SUPERSEDED' ? 0.6 : 1 }}>
                    <td style={{ padding: '10px 8px' }}>
                      {r.reference}
                      <div style={{ color: 'var(--slate)', fontSize: '0.8rem' }}>{r.company_name}</div>
                    </td>
                    <td style={{ padding: '10px 8px' }}>{TYPE_LABEL[r.email_type] ?? r.email_type}</td>
                    <td style={{ padding: '10px 8px' }}>{r.recipient}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span style={{ color: STATUS_COLOR[r.status] ?? 'var(--slate)', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.78rem' }}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px', color: 'var(--slate)', fontSize: '0.85rem', maxWidth: 320 }}>{detail(r)}</td>
                    <td style={{ padding: '10px 8px' }}>{r.attempt_count}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--slate)' }}>{when(r.sent_at)}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--slate)' }}>{when(r.delivered_at)}</td>
                    <td style={{ padding: '10px 8px' }}>
                      {canRetry && (
                        <button type="button" className="btn" disabled={busyId === key} onClick={() => retry(r)}>
                          {busyId === key ? 'Sending…' : 'Retry'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

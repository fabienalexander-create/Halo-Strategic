'use client';

import { useEffect, useState } from 'react';
import { apiPath } from '../../../lib/basePath';

interface EmailRow {
  id: number;
  prospect_id: number;
  prospect_reference: string;
  company_name: string;
  contact_name: string;
  nurture_step: number;
  recipient: string;
  status: string;
  error_message: string | null;
  attempt_count: number;
  sent_at: string | null;
  delivered_at: string | null;
  created_at: string;
  prospect_nurture_status: string;
  prospect_email_bounced_at: string | null;
  prospect_email_complained_at: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#B08D57',
  SENT: '#1B2A4A',
  DELIVERED: '#2f4a33',
  FAILED: '#8C4438',
  BOUNCED: '#8C4438',
  COMPLAINED: '#8C4438',
  SUPPRESSED: '#6b5b00',
};

const FILTERS = ['All', 'FAILED', 'SUPPRESSED', 'SENT', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'PENDING'] as const;

// Why a row is SUPPRESSED, read off the prospect's own state rather than guessed -- matches
// exactly what lib/buyerProspectEmail.ts checks before attempting a send.
function suppressionReason(r: EmailRow): string | null {
  if (r.prospect_nurture_status === 'UNSUBSCRIBED') return 'unsubscribed';
  if (r.prospect_nurture_status === 'PAUSED') return 'paused';
  if (r.prospect_email_bounced_at) return 'previously bounced';
  if (r.prospect_email_complained_at) return 'previously complained';
  return null;
}

export default function ProspectEmailQueue() {
  const [rows, setRows] = useState<EmailRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<(typeof FILTERS)[number]>('All');

  useEffect(() => {
    const query = statusFilter === 'All' ? '' : `?status=${statusFilter}`;
    setRows(null);
    fetch(apiPath(`/api/admin/prospect-emails${query}`))
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to load.');
        return r.json();
      })
      .then((data) => setRows(data.emails))
      .catch((e) => setError(e.message));
  }, [statusFilter]);

  if (error) return <div className="disclaimer-box">{error}</div>;

  return (
    <div>
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

      {!rows ? (
        <p>Loading&hellip;</p>
      ) : rows.length === 0 ? (
        <p>No prospect emails match this filter.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '10px 8px' }}>Prospect</th>
                <th style={{ padding: '10px 8px' }}>Step</th>
                <th style={{ padding: '10px 8px' }}>Recipient</th>
                <th style={{ padding: '10px 8px' }}>Status</th>
                <th style={{ padding: '10px 8px' }}>Reason / error</th>
                <th style={{ padding: '10px 8px' }}>Attempts</th>
                <th style={{ padding: '10px 8px' }}>Sent</th>
                <th style={{ padding: '10px 8px' }}>Delivered</th>
                <th style={{ padding: '10px 8px' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const reason = suppressionReason(r);
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 8px' }}>
                      {r.prospect_reference}
                      <div style={{ color: 'var(--slate)', fontSize: '0.8rem' }}>{r.company_name}</div>
                    </td>
                    <td style={{ padding: '10px 8px' }}>{r.nurture_step}</td>
                    <td style={{ padding: '10px 8px' }}>{r.recipient}</td>
                    <td style={{ padding: '10px 8px' }}>
                      <span
                        style={{
                          color: STATUS_COLOR[r.status] ?? 'var(--slate)',
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: '0.78rem',
                        }}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 8px', color: 'var(--slate)', fontSize: '0.85rem' }}>
                      {r.status === 'SUPPRESSED' && reason ? `Suppressed: ${reason}` : r.error_message ?? '—'}
                    </td>
                    <td style={{ padding: '10px 8px' }}>{r.attempt_count}</td>
                    <td style={{ padding: '10px 8px', color: 'var(--slate)' }}>
                      {r.sent_at ? new Date(r.sent_at).toLocaleString('en-GB') : '—'}
                    </td>
                    <td style={{ padding: '10px 8px', color: 'var(--slate)' }}>
                      {r.delivered_at ? new Date(r.delivered_at).toLocaleString('en-GB') : '—'}
                    </td>
                    <td style={{ padding: '10px 8px', color: 'var(--slate)' }}>
                      {new Date(r.created_at).toLocaleDateString('en-GB')}
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

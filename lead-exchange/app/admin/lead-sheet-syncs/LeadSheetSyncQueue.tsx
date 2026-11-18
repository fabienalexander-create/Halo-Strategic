'use client';

import { useEffect, useState } from 'react';
import { apiPath } from '../../../lib/basePath';

interface SyncRow {
  id: number;
  lead_id: number;
  industry_id: number;
  status: 'PENDING' | 'SYNCED' | 'FAILED';
  sheet_row_number: number | null;
  attempt_count: number;
  error_message: string | null;
  synced_at: string | null;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#B08D57',
  SYNCED: '#2f4a33',
  FAILED: '#8C4438',
};

const FILTERS = ['All', 'FAILED', 'PENDING', 'SYNCED'] as const;

export default function LeadSheetSyncQueue() {
  const [rows, setRows] = useState<SyncRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<(typeof FILTERS)[number]>('FAILED');
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [retryResult, setRetryResult] = useState<Record<number, string>>({});

  function load() {
    setRows(null);
    fetch(apiPath('/api/admin/lead-sheet-syncs'))
      .then(async (r) => { if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to load.'); return r.json(); })
      .then((data) => setRows(data.syncs))
      .catch((e) => setError(e.message));
  }

  useEffect(() => { load(); }, []);

  async function retry(id: number) {
    setRetryingId(id);
    try {
      const res = await fetch(apiPath(`/api/admin/lead-sheet-syncs/${id}/retry`), { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Retry failed.');
      setRetryResult((prev) => ({
        ...prev,
        [id]: data.synced ? 'Synced.' : data.skipped ? (data.alreadyPresent ? 'Already in the sheet -- marked synced.' : 'Already synced, no action needed.') : `Still failing: ${data.error ?? 'unknown error'}`,
      }));
      load();
    } catch (e) {
      setRetryResult((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : String(e) }));
    } finally {
      setRetryingId(null);
    }
  }

  if (error) return <div className="disclaimer-box">{error}</div>;

  const visibleRows = rows?.filter((r) => statusFilter === 'All' || r.status === statusFilter) ?? null;

  return (
    <div>
      <div className="form-row" style={{ maxWidth: 280, marginBottom: 16 }}>
        <label htmlFor="status-filter">Filter by status</label>
        <select id="status-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as (typeof FILTERS)[number])}>
          {FILTERS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      {!visibleRows ? (
        <p>Loading&hellip;</p>
      ) : visibleRows.length === 0 ? (
        <p>No sync entries match this filter.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '10px 8px' }}>Lead</th>
                <th style={{ padding: '10px 8px' }}>Status</th>
                <th style={{ padding: '10px 8px' }}>Sheet row</th>
                <th style={{ padding: '10px 8px' }}>Attempts</th>
                <th style={{ padding: '10px 8px' }}>Error</th>
                <th style={{ padding: '10px 8px' }}>Created</th>
                <th style={{ padding: '10px 8px' }}></th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 8px' }}>HLX-LEAD-{String(r.lead_id).padStart(6, '0')}</td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{ color: STATUS_COLOR[r.status] ?? 'var(--slate)', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.78rem' }}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 8px', color: 'var(--slate)' }}>{r.sheet_row_number ?? '—'}</td>
                  <td style={{ padding: '10px 8px' }}>{r.attempt_count}</td>
                  <td style={{ padding: '10px 8px', color: 'var(--slate)', fontSize: '0.85rem' }}>{r.error_message ?? '—'}</td>
                  <td style={{ padding: '10px 8px', color: 'var(--slate)' }}>{new Date(r.created_at).toLocaleString('en-GB')}</td>
                  <td style={{ padding: '10px 8px' }}>
                    {r.status === 'FAILED' && (
                      <button
                        className="btn btn-bronze" style={{ fontSize: '0.78rem', padding: '4px 10px' }}
                        onClick={() => retry(r.id)} disabled={retryingId === r.id}
                      >
                        {retryingId === r.id ? 'Retrying…' : 'Retry'}
                      </button>
                    )}
                    {retryResult[r.id] && <div style={{ fontSize: '0.78rem', color: 'var(--slate)', marginTop: 4 }}>{retryResult[r.id]}</div>}
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

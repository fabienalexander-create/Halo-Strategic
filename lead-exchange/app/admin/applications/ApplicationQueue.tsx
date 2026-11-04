'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface AppRow {
  application_reference: string;
  company_name: string;
  contact_name: string;
  application_status: string;
  internal_suitability_score: number | null;
  weekly_lead_capacity: number | null;
  has_bought_leads_before: boolean | null;
  industry_name: string;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  PENDING_REVIEW: '#B08D57',
  NEEDS_MORE_INFO: '#8C6D1F',
  REJECTED: '#8C4438',
  PENDING_COMMERCIALS: '#1B2A4A',
  ACTIVE: '#2f4a33',
  SUSPENDED: '#8C4438',
};

export default function ApplicationQueue() {
  const [rows, setRows] = useState<AppRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/applications')
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to load.');
        return r.json();
      })
      .then((data) => setRows(data.applications))
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="disclaimer-box">{error}</div>;
  if (!rows) return <p>Loading&hellip;</p>;
  if (rows.length === 0) return <p>No applications yet.</p>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
            <th style={{ padding: '10px 8px' }}>Reference</th>
            <th style={{ padding: '10px 8px' }}>Company</th>
            <th style={{ padding: '10px 8px' }}>Industry</th>
            <th style={{ padding: '10px 8px' }}>Status</th>
            <th style={{ padding: '10px 8px' }}>Suitability</th>
            <th style={{ padding: '10px 8px' }}>Submitted</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.application_reference} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '10px 8px' }}>
                <Link href={`/admin/applications/${r.application_reference}`} style={{ color: 'var(--bronze)' }}>
                  {r.application_reference}
                </Link>
              </td>
              <td style={{ padding: '10px 8px' }}>
                {r.company_name}
                <div style={{ color: 'var(--slate)', fontSize: '0.8rem' }}>{r.contact_name}</div>
              </td>
              <td style={{ padding: '10px 8px' }}>{r.industry_name}</td>
              <td style={{ padding: '10px 8px' }}>
                <span
                  style={{
                    color: STATUS_COLOR[r.application_status] ?? 'var(--slate)',
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: '0.78rem',
                  }}
                >
                  {r.application_status}
                </span>
              </td>
              <td style={{ padding: '10px 8px' }}>{r.internal_suitability_score ?? '—'}</td>
              <td style={{ padding: '10px 8px', color: 'var(--slate)' }}>
                {new Date(r.created_at).toLocaleDateString('en-GB')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

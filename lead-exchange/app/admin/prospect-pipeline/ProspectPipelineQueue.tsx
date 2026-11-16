'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiPath } from '../../../lib/basePath';

interface ProspectRow {
  id: number;
  prospect_reference: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  telephone: string;
  postcodes_covered: string | null;
  sales_stage: string;
  personal_contact_authorised_at: string | null;
  next_follow_up_at: string | null;
  agreed_package_name: string | null;
  agreed_package_price: string | null;
  application_status: string | null;
  application_reference: string | null;
  industry_name: string;
  created_at: string;
}

const STAGES = ['All', 'NEW', 'CONTACT_AUTHORISED', 'CONTACTED', 'RESPONDED', 'QUALIFIED', 'CALL_COMPLETED', 'PACKAGE_AGREED'] as const;

const STAGE_COLOR: Record<string, string> = {
  NEW: '#B08D57',
  CONTACT_AUTHORISED: '#1B2A4A',
  CONTACTED: '#1B2A4A',
  RESPONDED: '#2f4a33',
  QUALIFIED: '#2f4a33',
  CALL_COMPLETED: '#2f4a33',
  PACKAGE_AGREED: '#6b5b00',
};

export default function ProspectPipelineQueue() {
  const [rows, setRows] = useState<ProspectRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<(typeof STAGES)[number]>('All');
  const [dueOnly, setDueOnly] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (stageFilter !== 'All') params.set('stage', stageFilter);
    if (dueOnly) params.set('follow_up_due_before', new Date().toISOString());
    const query = params.toString();
    setRows(null);
    fetch(apiPath(`/api/admin/prospect-pipeline${query ? `?${query}` : ''}`))
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to load.');
        return r.json();
      })
      .then((data) => setRows(data.prospects))
      .catch((e) => setError(e.message));
  }, [stageFilter, dueOnly]);

  if (error) return <div className="disclaimer-box">{error}</div>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        <div className="form-row" style={{ maxWidth: 240 }}>
          <label htmlFor="stage-filter">Filter by stage</label>
          <select id="stage-filter" value={stageFilter} onChange={(e) => setStageFilter(e.target.value as (typeof STAGES)[number])}>
            {STAGES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 24 }}>
          <input type="checkbox" checked={dueOnly} onChange={(e) => setDueOnly(e.target.checked)} style={{ width: 'auto' }} />
          Follow-up due now
        </label>
      </div>

      {!rows ? (
        <p>Loading&hellip;</p>
      ) : rows.length === 0 ? (
        <p>No prospects match this filter.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '10px 8px' }}>Prospect</th>
                <th style={{ padding: '10px 8px' }}>Industry / Coverage</th>
                <th style={{ padding: '10px 8px' }}>Stage</th>
                <th style={{ padding: '10px 8px' }}>Contact authorised?</th>
                <th style={{ padding: '10px 8px' }}>Agreed package</th>
                <th style={{ padding: '10px 8px' }}>Application</th>
                <th style={{ padding: '10px 8px' }}>Next follow-up</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.prospect_reference} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 8px' }}>
                    <Link href={`/admin/prospect-pipeline/${r.prospect_reference}`} style={{ color: 'var(--bronze)' }}>
                      {r.prospect_reference}
                    </Link>
                    <div style={{ color: 'var(--slate)', fontSize: '0.8rem' }}>{r.company_name} &middot; {r.contact_name}</div>
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    {r.industry_name}
                    <div style={{ color: 'var(--slate)', fontSize: '0.8rem' }}>{r.postcodes_covered ?? '—'}</div>
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{ color: STAGE_COLOR[r.sales_stage] ?? 'var(--slate)', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.78rem' }}>
                      {r.sales_stage}
                    </span>
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    {r.personal_contact_authorised_at ? (
                      <span style={{ color: '#2f4a33' }}>Yes</span>
                    ) : (
                      <span style={{ color: '#8C4438', fontWeight: 600 }}>Not authorised</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    {r.agreed_package_name ? `${r.agreed_package_name} (£${r.agreed_package_price})` : '—'}
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    {r.application_reference ? (
                      <>
                        {r.application_reference}
                        <div style={{ color: 'var(--slate)', fontSize: '0.8rem' }}>{r.application_status}</div>
                      </>
                    ) : '—'}
                  </td>
                  <td style={{ padding: '10px 8px', color: 'var(--slate)' }}>
                    {r.next_follow_up_at ? new Date(r.next_follow_up_at).toLocaleString('en-GB') : '—'}
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

'use client';

import { useEffect, useState } from 'react';
import { apiPath } from '../../../../lib/basePath';

const STAGE_ORDER = ['NEW', 'CONTACT_AUTHORISED', 'CONTACTED', 'RESPONDED', 'QUALIFIED', 'CALL_COMPLETED', 'PACKAGE_AGREED'];

interface Prospect {
  id: number;
  prospect_reference: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  telephone: string;
  sales_stage: string;
  personal_contact_authorised_at: string | null;
  personal_contact_authorised_by: string | null;
  contact_authorisation_basis: string | null;
  agreed_package_name: string | null;
  agreed_package_price: string | null;
  application_status: string | null;
  application_reference: string | null;
  next_follow_up_at: string | null;
  industry_name: string;
}

interface ActivityRow {
  id: number;
  activity_type: string;
  previous_stage: string | null;
  new_stage: string | null;
  note: string | null;
  recorded_by: string;
  occurred_at: string;
}

interface PackageOption {
  id: number;
  name: string;
  price: string;
  leads_included: number;
}

const NON_STAGE_ACTIVITY_TYPES = ['EMAIL_SENT', 'SMS_SENT', 'RESPONSE_RECEIVED', 'CALL_ATTEMPTED', 'CALL_COMPLETED', 'QUALIFICATION_NOTE', 'FOLLOW_UP_SCHEDULED'] as const;

export default function ProspectDetail({ reference }: { reference: string }) {
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [packages, setPackages] = useState<PackageOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [note, setNote] = useState('');
  const [authorisationBasis, setAuthorisationBasis] = useState('');
  const [packageId, setPackageId] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [logType, setLogType] = useState<(typeof NON_STAGE_ACTIVITY_TYPES)[number]>('EMAIL_SENT');

  function load() {
    fetch(apiPath(`/api/admin/prospect-pipeline/${reference}`))
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to load.');
        return r.json();
      })
      .then((data) => {
        setProspect(data.prospect);
        setActivity(data.activity);
        setPackages(data.available_packages);
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => { load(); }, [reference]);

  async function postActivity(payload: Record<string, unknown>) {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(apiPath(`/api/admin/prospect-pipeline/${reference}/activity`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to record activity.');
      setNote('');
      setAuthorisationBasis('');
      setPackageId('');
      setFollowUpAt('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !prospect) return <div className="disclaimer-box">{error}</div>;
  if (!prospect) return <p>Loading&hellip;</p>;

  const currentIndex = STAGE_ORDER.indexOf(prospect.sales_stage);
  const nextStage = currentIndex >= 0 && currentIndex < STAGE_ORDER.length - 1 ? STAGE_ORDER[currentIndex + 1] : null;
  const isAuthorised = !!prospect.personal_contact_authorised_at;

  return (
    <div>
      {error && <div className="disclaimer-box" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="form-card" style={{ marginBottom: 20 }}>
        <p><strong>{prospect.company_name}</strong> &middot; {prospect.contact_name}</p>
        <p style={{ color: 'var(--slate)' }}>{prospect.contact_email} &middot; {prospect.telephone} &middot; {prospect.industry_name}</p>
        <p>Stage: <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{prospect.sales_stage}</span></p>
        <p>
          Contact authorised:{' '}
          {isAuthorised ? (
            <span style={{ color: '#2f4a33' }}>
              Yes, by {prospect.personal_contact_authorised_by} ({prospect.personal_contact_authorised_at ? new Date(prospect.personal_contact_authorised_at).toLocaleString('en-GB') : ''})
              <br /><span style={{ color: 'var(--slate)', fontSize: '0.85rem' }}>Basis: {prospect.contact_authorisation_basis}</span>
            </span>
          ) : (
            <span style={{ color: '#8C4438', fontWeight: 600 }}>NOT AUTHORISED &mdash; do not contact</span>
          )}
        </p>
        {prospect.agreed_package_name && <p>Agreed package: {prospect.agreed_package_name} (£{prospect.agreed_package_price})</p>}
        {prospect.application_reference && <p>Linked application: {prospect.application_reference} ({prospect.application_status})</p>}
      </div>

      <div className="form-card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: 12 }}>Advance stage</h3>
        {!nextStage ? (
          <p style={{ color: 'var(--slate)' }}>Already at the final sales-pipeline stage.</p>
        ) : nextStage === 'CONTACT_AUTHORISED' ? (
          <>
            <p className="form-note">
              This is the one decision that must never be automatic. Record the actual lawful basis
              for contacting this person &mdash; not just &ldquo;they registered on Meta&rdquo;.
            </p>
            <div className="form-row">
              <label htmlFor="basis">Lawful basis for contact (required)</label>
              <textarea id="basis" value={authorisationBasis} onChange={(e) => setAuthorisationBasis(e.target.value)} />
            </div>
            <button
              className="btn btn-bronze" disabled={submitting || !authorisationBasis.trim()}
              onClick={() => postActivity({ activity_type: 'STAGE_CHANGE', new_stage: 'CONTACT_AUTHORISED', authorisation_basis: authorisationBasis })}
            >
              Authorise contact
            </button>
          </>
        ) : nextStage === 'PACKAGE_AGREED' ? (
          <>
            <div className="form-row">
              <label htmlFor="package">Package verbally agreed</label>
              <select id="package" value={packageId} onChange={(e) => setPackageId(e.target.value)}>
                <option value="">Select one</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} &ndash; £{p.price} ({p.leads_included} credits)</option>
                ))}
              </select>
            </div>
            <button
              className="btn btn-bronze" disabled={submitting || !packageId}
              onClick={() => postActivity({ activity_type: 'STAGE_CHANGE', new_stage: 'PACKAGE_AGREED', agreed_package_definition_id: Number(packageId) })}
            >
              Record package agreed
            </button>
          </>
        ) : (
          <button
            className="btn btn-bronze" disabled={submitting}
            onClick={() => postActivity({ activity_type: 'STAGE_CHANGE', new_stage: nextStage })}
          >
            Move to {nextStage}
          </button>
        )}
      </div>

      <div className="form-card" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: 12 }}>Log activity (no stage change)</h3>
        <div className="form-row">
          <label htmlFor="log-type">Type</label>
          <select id="log-type" value={logType} onChange={(e) => setLogType(e.target.value as typeof logType)}>
            {NON_STAGE_ACTIVITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label htmlFor="note">Note</label>
          <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="form-row">
          <label htmlFor="follow-up">Next follow-up (optional)</label>
          <input id="follow-up" type="datetime-local" value={followUpAt} onChange={(e) => setFollowUpAt(e.target.value)} />
        </div>
        <button
          className="btn btn-bronze" disabled={submitting}
          onClick={() => postActivity({ activity_type: logType, note: note || undefined, next_follow_up_at: followUpAt ? new Date(followUpAt).toISOString() : undefined })}
        >
          Log activity
        </button>
      </div>

      <div>
        <h3 style={{ fontSize: '1.1rem', marginBottom: 12 }}>Activity history</h3>
        {activity.length === 0 ? <p>No activity recorded yet.</p> : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {activity.map((a) => (
              <li key={a.id} style={{ borderBottom: '1px solid var(--border)', padding: '10px 0' }}>
                <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.78rem', color: 'var(--bronze)' }}>{a.activity_type}</span>
                {a.previous_stage && a.new_stage && <span style={{ color: 'var(--slate)' }}> &nbsp;{a.previous_stage} &rarr; {a.new_stage}</span>}
                {a.note && <p style={{ margin: '4px 0 0' }}>{a.note}</p>}
                <p style={{ margin: '4px 0 0', color: 'var(--slate)', fontSize: '0.8rem' }}>
                  {a.recorded_by} &middot; {new Date(a.occurred_at).toLocaleString('en-GB')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

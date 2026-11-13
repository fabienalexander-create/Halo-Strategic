'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiPath } from '../../../../lib/basePath';

type Buyer = Record<string, unknown>;
interface Note { id: number; admin_email: string; note: string; created_at: string; }
interface AuditEntry { id: number; actor: string; action: string; previous_state: unknown; new_state: unknown; created_at: string; }

function Field({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined || value === '') return null;
  let display: string;
  if (Array.isArray(value)) display = value.join(', ');
  else if (typeof value === 'boolean') display = value ? 'Yes' : 'No';
  else if (typeof value === 'object') display = JSON.stringify(value);
  else display = String(value);
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16 }}>
      <div style={{ minWidth: 220, color: 'var(--slate)', fontSize: '0.85rem' }}>{label}</div>
      <div style={{ fontSize: '0.92rem' }}>{display}</div>
    </div>
  );
}

const FIELD_GROUPS: { title: string; fields: [string, string][] }[] = [
  {
    title: 'Business profile',
    fields: [
      ['company_name', 'Company name'], ['website', 'Website'], ['contact_name', 'Contact name'],
      ['contact_email', 'Contact email'], ['telephone', 'Telephone'],
      ['company_registration_number', 'Registration number'], ['years_operating', 'Years operating'],
      ['business_location', 'Business location'],
    ],
  },
  {
    title: 'Services & capability',
    fields: [
      ['services_offered', 'Services offered'], ['does_own_fulfilment', 'Does own fulfilment'],
      ['has_required_insurance_and_quals', 'Has required insurance/quals'],
    ],
  },
  {
    title: 'Geographic coverage',
    fields: [
      ['counties_covered', 'Counties covered'], ['postcodes_covered', 'Postcodes covered'],
      ['coverage_type', 'Coverage type'], ['excluded_areas', 'Excluded areas'],
      ['max_travel_distance_miles', 'Max travel distance (miles)'],
    ],
  },
  {
    title: 'Lead requirements',
    fields: [
      ['weekly_lead_capacity', 'Weekly lead capacity (stated)'], ['preferred_monthly_volume', 'Preferred monthly volume'],
      ['volume_preference', 'Volume preference'], ['accepts_long_term_prospects', 'Accepts long-term prospects'],
      ['property_types_accepted', 'Property types accepted'], ['min_project_value', 'Min project value'],
      ['max_project_value', 'Max project value'],
    ],
  },
  {
    title: 'Previous lead-buying experience',
    fields: [
      ['has_bought_leads_before', 'Bought leads before'], ['previous_lead_providers', 'Previous providers'],
      ['previous_leads_exclusive_or_shared', 'Previous exclusivity'], ['previous_price_paid_per_lead', 'Previous price paid'],
      ['previous_leads_worthwhile_pct', 'Previous leads worthwhile %'], ['previous_supplier_problems', 'Previous supplier problems'],
      ['reliability_criteria', 'Reliability criteria'],
    ],
  },
  {
    title: 'Commercial preferences (stated by applicant)',
    fields: [
      ['exclusivity_preference', 'Exclusivity preference'], ['preferred_price_range_low', 'Preferred price, low'],
      ['preferred_price_range_high', 'Preferred price, high'], ['purchase_model_preference', 'Purchase model preference'],
    ],
  },
  {
    title: 'Sales process & capacity',
    fields: [
      ['who_handles_enquiries', 'Who handles enquiries'], ['has_dedicated_sales_team', 'Dedicated sales team'],
      ['can_contact_during_business_hours', 'Can contact during business hours'],
      ['typical_first_response_time', 'Typical first-response time'], ['surveys_per_week_capacity', 'Surveys/week capacity'],
      ['typical_qualified_to_job_conversion_pct', 'Qualified-to-job conversion %'],
      ['avg_revenue_per_completed_job', 'Avg revenue per job'],
    ],
  },
  {
    title: 'Consent & terms',
    fields: [
      ['confirmed_info_accurate', 'Confirmed info accurate'], ['confirmed_can_deliver_services', 'Confirmed can deliver'],
      ['agreed_buyer_terms_at', 'Agreed buyer terms at'], ['agreed_buyer_terms_version', 'Buyer terms version'],
      ['acknowledged_replacement_policy_at', 'Acknowledged replacement policy at'],
      ['acknowledged_replacement_policy_version', 'Replacement policy version'],
      ['confirmed_payment_before_release_understanding', 'Confirmed payment-before-release understanding'],
      ['agreed_pii_handling', 'Agreed PII handling'], ['agreed_account_notifications', 'Agreed account notifications'],
      ['marketing_consent', 'Marketing consent'],
    ],
  },
  {
    title: 'Internal (admin only)',
    fields: [
      ['internal_suitability_score', 'Suitability score'], ['internal_suitability_notes', 'Suitability notes'],
    ],
  },
  {
    title: 'Commercial configuration',
    fields: [
      ['agreed_price_per_lead', 'Agreed price per lead'], ['agreed_currency', 'Currency'],
      ['exclusivity_arrangement', 'Exclusivity arrangement'], ['agreed_weekly_capacity', 'Agreed weekly capacity'],
      ['payment_arrangement_notes', 'Payment arrangement notes'], ['agreed_pricing_notes', 'Pricing notes'],
      ['commercials_configured_by', 'Commercials configured by'], ['commercials_configured_at', 'Commercials configured at'],
      ['onboarding_call_completed_at', 'Onboarding call completed at'], ['onboarding_call_conducted_by', 'Onboarding call conducted by'],
      ['went_active_by', 'Activated by'], ['went_active_at', 'Activated at'],
    ],
  },
];

export default function ApplicationDetail({ reference }: { reference: string }) {
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [auditTrail, setAuditTrail] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [newNote, setNewNote] = useState('');
  const [me, setMe] = useState<{ email: string; role: string } | null>(null);
  const [callPanelOpen, setCallPanelOpen] = useState(false);
  const [callConductor, setCallConductor] = useState('');
  const [callConfirmed, setCallConfirmed] = useState(false);
  const [fixPanelOpen, setFixPanelOpen] = useState(false);
  const [fixReason, setFixReason] = useState('');
  const [fixConfirmed, setFixConfirmed] = useState(false);
  const [commercials, setCommercials] = useState({
    agreed_price_per_lead: '', agreed_currency: 'GBP', exclusivity_arrangement: '',
    agreed_weekly_capacity: '', payment_arrangement_notes: '', agreed_pricing_notes: '',
  });

  const load = useCallback(() => {
    fetch(apiPath(`/api/admin/applications/${reference}`))
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to load.');
        return r.json();
      })
      .then((data) => {
        setBuyer(data.buyer);
        setNotes(data.notes);
        setAuditTrail(data.audit_trail);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [reference]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch(apiPath('/api/admin/me'))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) { setMe(data); setCallConductor(data.email); } })
      .catch(() => {});
  }, []);

  async function runDecision(action: 'approve' | 'reject' | 'request_info') {
    setActionMessage(null);
    const res = await fetch(apiPath(`/api/admin/applications/${reference}/decision`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason: reason || undefined }),
    });
    const data = await res.json();
    if (!res.ok) { setActionMessage(`Error: ${data.error}`); return; }
    setActionMessage(`Status is now ${data.application_status}.`);
    setReason('');
    load();
  }

  async function submitNote() {
    if (!newNote.trim()) return;
    const res = await fetch(apiPath(`/api/admin/applications/${reference}/notes`), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: newNote }),
    });
    if (res.ok) { setNewNote(''); load(); }
  }

  async function submitCommercials() {
    setActionMessage(null);
    const payload: Record<string, unknown> = {};
    if (commercials.agreed_price_per_lead) payload.agreed_price_per_lead = Number(commercials.agreed_price_per_lead);
    if (commercials.agreed_currency) payload.agreed_currency = commercials.agreed_currency;
    if (commercials.exclusivity_arrangement) payload.exclusivity_arrangement = commercials.exclusivity_arrangement;
    if (commercials.agreed_weekly_capacity) payload.agreed_weekly_capacity = Number(commercials.agreed_weekly_capacity);
    if (commercials.payment_arrangement_notes) payload.payment_arrangement_notes = commercials.payment_arrangement_notes;
    if (commercials.agreed_pricing_notes) payload.agreed_pricing_notes = commercials.agreed_pricing_notes;

    const res = await fetch(apiPath(`/api/admin/applications/${reference}/commercials`), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const data = await res.json();
    setActionMessage(res.ok ? 'Commercials saved.' : `Error: ${data.error}`);
    if (res.ok) load();
  }

  async function recordOnboardingCall() {
    setActionMessage(null);
    const res = await fetch(apiPath(`/api/admin/applications/${reference}/onboarding-call`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conducted_by: callConductor, confirm_call_took_place: callConfirmed }),
    });
    const data = await res.json();
    setActionMessage(res.ok ? 'Onboarding call recorded.' : `Error: ${data.error}`);
    if (res.ok) { setCallPanelOpen(false); setCallConfirmed(false); load(); }
  }

  async function correctOnboardingCall() {
    setActionMessage(null);
    const res = await fetch(apiPath(`/api/admin/applications/${reference}/onboarding-call/correct`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: fixReason, confirm_correction: fixConfirmed }),
    });
    const data = await res.json();
    setActionMessage(res.ok ? 'Onboarding call record cleared and the correction logged. Record the call again when ready.' : `Error: ${data.error}`);
    if (res.ok) { setFixPanelOpen(false); setFixConfirmed(false); setFixReason(''); load(); }
  }

  async function activate() {
    setActionMessage(null);
    const res = await fetch(apiPath(`/api/admin/applications/${reference}/activate`), { method: 'POST' });
    const data = await res.json();
    setActionMessage(res.ok ? 'Buyer is now ACTIVE.' : `Error: ${data.error}${data.missing_fields ? ` (missing: ${data.missing_fields.join(', ')})` : ''}`);
    if (res.ok) load();
  }

  if (error) return <div className="disclaimer-box">{error}</div>;
  if (!buyer) return <p>Loading&hellip;</p>;

  const status = buyer.application_status as string;

  return (
    <div>
      <p>
        <strong>Status:</strong> <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{status}</span>
      </p>

      {actionMessage && <div className="disclaimer-box" style={{ marginBottom: 16 }}>{actionMessage}</div>}

      {(status === 'PENDING_REVIEW' || status === 'NEEDS_MORE_INFO') && (
        <div className="form-card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>Review decision</h3>
          <div className="form-row">
            <label htmlFor="reason">Reason (required for reject / request info)</label>
            <textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-bronze" onClick={() => runDecision('approve')}>Approve</button>
            <button className="btn" style={{ border: '1px solid var(--border)' }} onClick={() => runDecision('request_info')}>
              Request More Info
            </button>
            <button className="btn" style={{ border: '1px solid #8C4438', color: '#8C4438' }} onClick={() => runDecision('reject')}>
              Reject
            </button>
          </div>
        </div>
      )}

      {status === 'PENDING_COMMERCIALS' && (
        <div className="form-card" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 12 }}>Configure commercials</h3>
          <div className="form-row">
            <label>Agreed price per lead</label>
            <input type="number" value={commercials.agreed_price_per_lead}
              onChange={(e) => setCommercials({ ...commercials, agreed_price_per_lead: e.target.value })} />
          </div>
          <div className="form-row">
            <label>Currency</label>
            <input type="text" value={commercials.agreed_currency}
              onChange={(e) => setCommercials({ ...commercials, agreed_currency: e.target.value })} />
          </div>
          <div className="form-row">
            <label>Exclusivity arrangement</label>
            <select value={commercials.exclusivity_arrangement}
              onChange={(e) => setCommercials({ ...commercials, exclusivity_arrangement: e.target.value })}>
              <option value="">Select one</option>
              <option value="exclusive">Exclusive</option>
              <option value="shared">Shared</option>
            </select>
          </div>
          <div className="form-row">
            <label>Agreed weekly capacity</label>
            <input type="number" value={commercials.agreed_weekly_capacity}
              onChange={(e) => setCommercials({ ...commercials, agreed_weekly_capacity: e.target.value })} />
          </div>
          <div className="form-row">
            <label>Payment arrangement notes</label>
            <textarea value={commercials.payment_arrangement_notes}
              onChange={(e) => setCommercials({ ...commercials, payment_arrangement_notes: e.target.value })} />
          </div>
          <div className="form-row">
            <label>Pricing notes</label>
            <textarea value={commercials.agreed_pricing_notes}
              onChange={(e) => setCommercials({ ...commercials, agreed_pricing_notes: e.target.value })} />
          </div>
          <button className="btn" style={{ border: '1px solid var(--border)', marginRight: 10 }} onClick={submitCommercials}>
            Save Commercials
          </button>
          <button className="btn" style={{ border: '1px solid var(--border)', marginRight: 10 }}
            disabled={me?.role !== 'owner' || !!buyer.onboarding_call_completed_at}
            onClick={() => setCallPanelOpen(true)}>
            {buyer.onboarding_call_completed_at ? 'Onboarding Call Recorded' : 'Record Onboarding Call Completed'}
          </button>
          {me?.role === 'owner' && !!buyer.onboarding_call_completed_at && (
            <button className="btn" style={{ border: '1px solid var(--border)', marginRight: 10 }} onClick={() => setFixPanelOpen(true)}>
              Correct Call Record
            </button>
          )}
          <button className="btn btn-bronze" disabled={me?.role !== 'owner'} onClick={activate}>
            Activate Buyer
          </button>
          <p className="form-note" style={{ textAlign: 'left' }}>
            Activation is refused until the onboarding call is recorded and price, exclusivity, capacity and payment notes are all set. Recording the call, correcting it and activating are owner-only.
          </p>
        </div>
      )}

      {callPanelOpen && status === 'PENDING_COMMERCIALS' && (
        <div className="disclaimer-box" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 8 }}>Record onboarding call for {String(buyer.company_name)}</h3>
          <p style={{ marginBottom: 8 }}>
            This is a permanent record and the final sign-off before activation. Only record it once the call has actually taken place.
          </p>
          <div className="form-row">
            <label>Call conducted by</label>
            <input type="text" value={callConductor} maxLength={100} onChange={(e) => setCallConductor(e.target.value)} />
          </div>
          <label style={{ display: 'block', margin: '8px 0 12px' }}>
            <input type="checkbox" checked={callConfirmed} onChange={(e) => setCallConfirmed(e.target.checked)} />{' '}
            I confirm the onboarding call with {String(buyer.company_name)} has taken place.
          </label>
          <button className="btn btn-bronze" disabled={!callConfirmed || callConductor.trim().length < 2} onClick={recordOnboardingCall}>
            Confirm and record
          </button>{' '}
          <button className="btn" style={{ border: '1px solid var(--border)' }} onClick={() => { setCallPanelOpen(false); setCallConfirmed(false); }}>
            Cancel
          </button>
        </div>
      )}

      {fixPanelOpen && status === 'PENDING_COMMERCIALS' && (
        <div className="disclaimer-box" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 8 }}>Correct onboarding call record for {String(buyer.company_name)}</h3>
          <p style={{ marginBottom: 8 }}>
            This clears the current call record and writes the previous details and your reason to the permanent audit log. The original entry is kept. You will need to record the call again before activation.
          </p>
          <div className="form-row">
            <label>Reason for correction (required, 10 to 500 characters)</label>
            <textarea value={fixReason} maxLength={500} onChange={(e) => setFixReason(e.target.value)} />
          </div>
          <label style={{ display: 'block', margin: '8px 0 12px' }}>
            <input type="checkbox" checked={fixConfirmed} onChange={(e) => setFixConfirmed(e.target.checked)} />{' '}
            I confirm I want to clear the onboarding call record for {String(buyer.company_name)}.
          </label>
          <button className="btn btn-bronze" disabled={!fixConfirmed || fixReason.trim().length < 10} onClick={correctOnboardingCall}>
            Confirm correction
          </button>{' '}
          <button className="btn" style={{ border: '1px solid var(--border)' }} onClick={() => { setFixPanelOpen(false); setFixConfirmed(false); }}>
            Cancel
          </button>
        </div>
      )}

      {FIELD_GROUPS.map((group) => (
        <div key={group.title} style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 8 }}>{group.title}</h3>
          {group.fields.map(([key, label]) => (
            <Field key={key} label={label} value={buyer[key]} />
          ))}
        </div>
      ))}

      <div style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: '1rem', marginBottom: 8 }}>Internal notes</h3>
        {notes.map((n) => (
          <div key={n.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>
            <div style={{ color: 'var(--slate)', fontSize: '0.78rem' }}>
              {n.admin_email} &middot; {new Date(n.created_at).toLocaleString('en-GB')}
            </div>
            {n.note}
          </div>
        ))}
        <div className="form-row" style={{ marginTop: 12 }}>
          <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder="Add a note…" />
        </div>
        <button className="btn" style={{ border: '1px solid var(--border)' }} onClick={submitNote}>
          Add Note
        </button>
      </div>

      <div>
        <h3 style={{ fontSize: '1rem', marginBottom: 8 }}>Audit trail</h3>
        {auditTrail.map((a) => (
          <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
            <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{a.action}</span> by {a.actor} &middot;{' '}
            {new Date(a.created_at).toLocaleString('en-GB')}
          </div>
        ))}
      </div>
    </div>
  );
}

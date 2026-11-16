'use client';

import { useEffect, useState } from 'react';
import { apiPath } from '../../../lib/basePath';

const INDUSTRIES = [
  { slug: 'spray_foam_removal', label: 'Spray Foam Removal' },
  { slug: 'solar_battery', label: 'Solar & Battery' },
  { slug: 'roofing', label: 'Roofing' },
];

interface LeadRow {
  id: number;
  status: string;
  homeowner_name: string;
  property_type: string | null;
  postcode: string;
  service_requirement: string | null;
  source: string | null;
  qualification_answers: { meta_lead_id?: string | null; source?: string | null } | null;
  created_at: string;
  industry_slug: string;
  industry_name: string;
  live_allocation_id: number | null;
  allocated_buyer: string | null;
}

interface BuyerOption {
  id: number;
  company_name: string;
  application_status: string;
  agreed_price_per_lead: number | null;
}

export default function LeadsQueue() {
  const [leads, setLeads] = useState<LeadRow[] | null>(null);
  const [buyers, setBuyers] = useState<BuyerOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expandedLeadId, setExpandedLeadId] = useState<number | null>(null);
  const [lastConfirmationId, setLastConfirmationId] = useState<Record<number, number>>({});

  const [newLead, setNewLead] = useState({
    industry_slug: 'spray_foam_removal', homeowner_name: '', mobile: '', email: '',
    property_type: '', postcode: '', service_requirement: '', source: '', meta_lead_id: '',
  });

  function load() {
    fetch(apiPath('/api/admin/leads'))
      .then(async (r) => { if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to load leads.'); return r.json(); })
      .then((data) => setLeads(data.leads))
      .catch((e) => setError(e.message));
    fetch(apiPath('/api/admin/buyers?status=ACTIVE'))
      .then(async (r) => { if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to load buyers.'); return r.json(); })
      .then((data) => setBuyers(data.buyers))
      .catch((e) => setError(e.message));
  }

  useEffect(() => { load(); }, []);

  async function addLead(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(apiPath('/api/admin/leads'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLead),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to add lead.');
      setNewLead({ industry_slug: 'spray_foam_removal', homeowner_name: '', mobile: '', email: '', property_type: '', postcode: '', service_requirement: '', source: '', meta_lead_id: '' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (error) return <div className="disclaimer-box" style={{ marginBottom: 16 }}>{error}</div>;

  return (
    <div>
      <div className="form-card" style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: 12 }}>Add a lead</h3>
        <p className="form-note">
          Paste in what you see in Meta Lead Centre or the Google Sheet. There is no automatic
          ingestion yet -- this is deliberately manual for now.
        </p>
        <form onSubmit={addLead}>
          <div className="form-row">
            <label htmlFor="industry">Industry</label>
            <select id="industry" value={newLead.industry_slug} onChange={(e) => setNewLead({ ...newLead, industry_slug: e.target.value })}>
              {INDUSTRIES.map((i) => <option key={i.slug} value={i.slug}>{i.label}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="homeowner_name">Homeowner name</label>
            <input id="homeowner_name" value={newLead.homeowner_name} onChange={(e) => setNewLead({ ...newLead, homeowner_name: e.target.value })} required />
          </div>
          <div className="form-row">
            <label htmlFor="mobile">Phone</label>
            <input id="mobile" value={newLead.mobile} onChange={(e) => setNewLead({ ...newLead, mobile: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={newLead.email} onChange={(e) => setNewLead({ ...newLead, email: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor="postcode">Postcode</label>
            <input id="postcode" value={newLead.postcode} onChange={(e) => setNewLead({ ...newLead, postcode: e.target.value })} required />
          </div>
          <div className="form-row">
            <label htmlFor="property_type">Property type</label>
            <input id="property_type" value={newLead.property_type} onChange={(e) => setNewLead({ ...newLead, property_type: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor="service_requirement">Service required</label>
            <input id="service_requirement" value={newLead.service_requirement} onChange={(e) => setNewLead({ ...newLead, service_requirement: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor="source">Source</label>
            <input id="source" placeholder="e.g. Meta Lead Centre" value={newLead.source} onChange={(e) => setNewLead({ ...newLead, source: e.target.value })} />
          </div>
          <div className="form-row">
            <label htmlFor="meta_lead_id">Meta lead ID (for traceability)</label>
            <input id="meta_lead_id" value={newLead.meta_lead_id} onChange={(e) => setNewLead({ ...newLead, meta_lead_id: e.target.value })} />
          </div>
          <button className="btn btn-bronze" disabled={submitting || !newLead.homeowner_name || !newLead.postcode || (!newLead.mobile && !newLead.email)} type="submit">
            Add lead
          </button>
        </form>
      </div>

      {!leads ? <p>Loading&hellip;</p> : leads.length === 0 ? <p>No leads yet.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '10px 8px' }}>Lead</th>
                <th style={{ padding: '10px 8px' }}>Industry</th>
                <th style={{ padding: '10px 8px' }}>Status</th>
                <th style={{ padding: '10px 8px' }}>Allocated to</th>
                <th style={{ padding: '10px 8px' }}></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <LeadRowItem
                  key={lead.id}
                  lead={lead}
                  buyers={buyers}
                  expanded={expandedLeadId === lead.id}
                  onToggle={() => setExpandedLeadId(expandedLeadId === lead.id ? null : lead.id)}
                  onChanged={load}
                  lastConfirmationId={lastConfirmationId[lead.id]}
                  onConfirmationRecorded={(confirmationId) => setLastConfirmationId((prev) => ({ ...prev, [lead.id]: confirmationId }))}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LeadRowItem({
  lead, buyers, expanded, onToggle, onChanged, lastConfirmationId, onConfirmationRecorded,
}: {
  lead: LeadRow; buyers: BuyerOption[]; expanded: boolean; onToggle: () => void; onChanged: () => void;
  lastConfirmationId?: number; onConfirmationRecorded: (id: number) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [confirmBuyerId, setConfirmBuyerId] = useState('');
  const [namedBusiness, setNamedBusiness] = useState('');
  const [homeownerResponse, setHomeownerResponse] = useState('');
  const [notes, setNotes] = useState('');

  const [allocBuyerId, setAllocBuyerId] = useState('');
  const [paymentLink, setPaymentLink] = useState('');

  async function recordConfirmation(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(apiPath('/api/admin/homeowner-confirmations'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id, buyer_id: Number(confirmBuyerId), named_business: namedBusiness,
          purpose: `to contact them about a ${lead.service_requirement ?? lead.industry_name} enquiry`,
          wording_used: `Asked whether they're happy to be introduced to ${namedBusiness} about their enquiry.`,
          homeowner_response: homeownerResponse, method: 'ADMIN_AFTER_CALL',
          confirmed_at: new Date().toISOString(), notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to record confirmation.');
      onConfirmationRecorded(data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function allocate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(apiPath(`/api/admin/leads/${lead.id}/allocate`), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyer_id: Number(allocBuyerId), homeowner_confirmation_id: lastConfirmationId,
          payment_link: paymentLink || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to allocate.');
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const metaLeadId = lead.qualification_answers?.meta_lead_id;

  return (
    <>
      <tr style={{ borderBottom: '1px solid var(--border)' }}>
        <td style={{ padding: '10px 8px' }}>
          HLX-LEAD-{String(lead.id).padStart(6, '0')}
          <div style={{ color: 'var(--slate)', fontSize: '0.8rem' }}>
            {lead.homeowner_name} &middot; {lead.postcode}
            {metaLeadId && <><br />Meta ID: {metaLeadId}</>}
          </div>
        </td>
        <td style={{ padding: '10px 8px' }}>{lead.industry_name}</td>
        <td style={{ padding: '10px 8px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.78rem' }}>{lead.status}</td>
        <td style={{ padding: '10px 8px' }}>{lead.allocated_buyer ?? '—'}</td>
        <td style={{ padding: '10px 8px' }}>
          {!lead.live_allocation_id && (
            <button className="btn btn-bronze" onClick={onToggle} style={{ fontSize: '0.82rem', padding: '6px 12px' }}>
              {expanded ? 'Close' : 'Allocate'}
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} style={{ padding: '14px 8px', background: 'var(--off-white, #faf9f7)' }}>
            {error && <div className="disclaimer-box" style={{ marginBottom: 12 }}>{error}</div>}

            <h4 style={{ fontSize: '0.95rem', marginBottom: 8 }}>
              Step 1 &mdash; Record homeowner confirmation {lastConfirmationId && <span style={{ color: '#2f4a33' }}>(recorded, confirmation #{lastConfirmationId})</span>}
            </h4>
            <p className="form-note">
              Mandatory before any offer. This must be a lead-specific, named-business confirmation
              &mdash; not inferred from the enquiry form's general consent checkbox.
            </p>
            <form onSubmit={recordConfirmation} style={{ marginBottom: 20 }}>
              <div className="form-row">
                <label>Buyer being named to the homeowner</label>
                <select value={confirmBuyerId} onChange={(e) => setConfirmBuyerId(e.target.value)} required>
                  <option value="">Select buyer</option>
                  {buyers.map((b) => <option key={b.id} value={b.id}>{b.company_name}</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>Named business (exactly as told to the homeowner)</label>
                <input value={namedBusiness} onChange={(e) => setNamedBusiness(e.target.value)} required />
              </div>
              <div className="form-row">
                <label>Homeowner's response (their actual words)</label>
                <input value={homeownerResponse} onChange={(e) => setHomeownerResponse(e.target.value)} required />
              </div>
              <div className="form-row">
                <label>Call notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} required />
              </div>
              <button className="btn btn-bronze" type="submit" disabled={submitting || !confirmBuyerId || !namedBusiness || !homeownerResponse || !notes}>
                Record confirmation
              </button>
            </form>

            <h4 style={{ fontSize: '0.95rem', marginBottom: 8 }}>Step 2 &mdash; Allocate and send redacted preview</h4>
            <form onSubmit={allocate}>
              <div className="form-row">
                <label>Buyer</label>
                <select value={allocBuyerId} onChange={(e) => setAllocBuyerId(e.target.value)} required>
                  <option value="">Select buyer</option>
                  {buyers.map((b) => <option key={b.id} value={b.id}>{b.company_name} (£{b.agreed_price_per_lead ?? '?'}/lead)</option>)}
                </select>
              </div>
              <div className="form-row">
                <label>Unique payment link for this lead</label>
                <input value={paymentLink} onChange={(e) => setPaymentLink(e.target.value)} placeholder="https://pay.tide.co/products/..." />
              </div>
              <button className="btn btn-bronze" type="submit" disabled={submitting || !allocBuyerId || !lastConfirmationId}>
                Allocate &amp; send preview
              </button>
              {!lastConfirmationId && <p className="form-note">Record the homeowner confirmation above first.</p>}
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

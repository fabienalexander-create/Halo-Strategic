'use client';

import { useEffect, useState } from 'react';
import { apiPath } from '../../../lib/basePath';
import { LIVE_CATEGORIES } from '../../../lib/industries';

const INDUSTRIES = LIVE_CATEGORIES.map((c) => ({ slug: c.slug, label: c.label }));

interface LeadRow {
  id: number;
  status: string;
  homeowner_name: string;
  property_type: string | null;
  postcode: string;
  service_requirement: string | null;
  source: string | null;
  qualification_answers: {
    meta_lead_id?: string | null; source?: string | null;
    needs_manual_review?: boolean; review_reasons?: string[]; lead_intent?: string;
  } | null;
  created_at: string;
  industry_slug: string;
  industry_name: string;
  live_allocations: { buyer_id: number; company_name: string; allocation_type: string }[] | null;
  lead_type?: 'VERIFIED_ENQUIRY' | 'BOOKED_APPOINTMENT';
}

interface BuyerOption {
  id: number;
  company_name: string;
  application_status: string;
  agreed_price_per_lead: number | null;
  agreed_price_per_appointment?: number | null;
  industry_slug?: string;
  exclusivity_arrangement?: 'exclusive' | 'shared' | null;
}

interface EligibleBuyer {
  id: number;
  company_name: string;
  agreed_price_per_lead: number | null;
  agreed_price_per_appointment?: number | null;
  exclusivity_arrangement: 'exclusive' | 'shared' | null;
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
    property_type: '', postcode: '', service_requirement: '', source: '', meta_lead_id: '', lead_type: 'VERIFIED_ENQUIRY',
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
      setNewLead({ industry_slug: 'spray_foam_removal', homeowner_name: '', mobile: '', email: '', property_type: '', postcode: '', service_requirement: '', source: '', meta_lead_id: '', lead_type: 'VERIFIED_ENQUIRY' });
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
            <label htmlFor="lead_type">Lead type</label>
            <select id="lead_type" value={newLead.lead_type} onChange={(e) => setNewLead({ ...newLead, lead_type: e.target.value })}>
              <option value="VERIFIED_ENQUIRY">Verified enquiry</option>
              <option value="BOOKED_APPOINTMENT">Booked appointment (one buyer only; date and time recorded at allocation)</option>
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
  const [replacementRequestId, setReplacementRequestId] = useState('');
  const [allocationType, setAllocationType] = useState<'EXCLUSIVE_WINDOW' | 'SHARED'>('SHARED');
  const [allocationTypeTouched, setAllocationTypeTouched] = useState(false);
  const [eligibleBuyers, setEligibleBuyers] = useState<EligibleBuyer[] | null>(null);
  const [showAllBuyers, setShowAllBuyers] = useState(false);
  const isAppointment = lead.lead_type === 'BOOKED_APPOINTMENT';
  const [apptAt, setApptAt] = useState('');
  const [apptKind, setApptKind] = useState<'IN_PERSON' | 'PHONE' | 'VIDEO'>('IN_PERSON');
  const [apptWhere, setApptWhere] = useState('');
  const [apptConfirmedAt, setApptConfirmedAt] = useState('');

  // Only buyers in the lead's own industry, ever -- the admin dropdowns used to list every
  // ACTIVE buyer regardless of industry, which meant nothing stopped a roofing lead being offered
  // to a solar installer.
  const industryBuyers = buyers.filter((b) => b.industry_slug === lead.industry_slug);

  useEffect(() => {
    if (!expanded) return;
    fetch(apiPath(`/api/admin/leads/${lead.id}/eligible-buyers`))
      .then(async (r) => { if (!r.ok) throw new Error((await r.json()).error ?? 'Failed to load eligible buyers.'); return r.json(); })
      .then((data) => setEligibleBuyers(data.buyers))
      .catch(() => setEligibleBuyers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, lead.id]);

  const allocOptions: { id: number; company_name: string; agreed_price_per_lead: number | null; agreed_price_per_appointment?: number | null }[] =
    showAllBuyers || eligibleBuyers === null || eligibleBuyers.length === 0 ? industryBuyers : eligibleBuyers;

  function onAllocBuyerChange(id: string) {
    setAllocBuyerId(id);
    if (allocationTypeTouched) return;
    // Follow the selected buyer's own contracted arrangement, same as the route's own default --
    // the admin can still override below, but shouldn't have to pick a type from nothing.
    const buyer = industryBuyers.find((b) => String(b.id) === id) ?? eligibleBuyers?.find((b) => String(b.id) === id);
    if (buyer?.exclusivity_arrangement === 'exclusive') setAllocationType('EXCLUSIVE_WINDOW');
    else setAllocationType('SHARED');
  }

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
          payment_link: replacementRequestId ? undefined : paymentLink || undefined, allocation_type: allocationType,
          replacement_request_id: replacementRequestId ? Number(replacementRequestId) : undefined,
          // datetime-local values are the admin's own local (UK) time; sent as an exact instant.
          appointment: isAppointment ? {
            scheduled_at: apptAt ? new Date(apptAt).toISOString() : undefined, kind: apptKind,
            location_notes: apptWhere || undefined,
            homeowner_confirmed_at: apptConfirmedAt ? new Date(apptConfirmedAt).toISOString() : undefined,
          } : undefined,
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

  async function changeLeadType() {
    const next = isAppointment ? 'VERIFIED_ENQUIRY' : 'BOOKED_APPOINTMENT';
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(apiPath(`/api/admin/leads/${lead.id}/lead-type`), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lead_type: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to change the lead type.');
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const metaLeadId = lead.qualification_answers?.meta_lead_id;
  const needsManualReview = lead.qualification_answers?.needs_manual_review === true;
  const reviewReasons = lead.qualification_answers?.review_reasons ?? [];
  const leadIntent = lead.qualification_answers?.lead_intent;

  return (
    <>
      <tr style={{ borderBottom: '1px solid var(--border)' }}>
        <td style={{ padding: '10px 8px' }}>
          HLX-LEAD-{String(lead.id).padStart(6, '0')}
          {isAppointment && (
            <span style={{ marginLeft: 6, fontSize: '0.72rem', fontWeight: 600, color: '#5a3d1e', background: '#f3e7d7', borderRadius: 4, padding: '1px 6px' }}>
              Booked appointment
            </span>
          )}
          <div style={{ color: 'var(--slate)', fontSize: '0.8rem' }}>
            {lead.homeowner_name} &middot; {lead.postcode}
            {metaLeadId && <><br />Meta ID: {metaLeadId}</>}
            {leadIntent === 'researching' && <><br /><span style={{ color: 'var(--slate)' }}>Researching only, not yet active</span></>}
          </div>
          {needsManualReview && (
            <div style={{ color: '#8C4438', fontSize: '0.78rem', fontWeight: 600, marginTop: 4 }}>
              ⚠ Needs manual review: {reviewReasons.join(', ')}
            </div>
          )}
        </td>
        <td style={{ padding: '10px 8px' }}>{lead.industry_name}</td>
        <td style={{ padding: '10px 8px', fontFamily: "'IBM Plex Mono', monospace", fontSize: '0.78rem' }}>{lead.status}</td>
        <td style={{ padding: '10px 8px' }}>
          {!lead.live_allocations || lead.live_allocations.length === 0 ? '—' : lead.live_allocations.map((a) => (
            <div key={a.buyer_id}>
              {a.company_name} <span style={{ color: 'var(--slate)', fontSize: '0.78rem' }}>({a.allocation_type === 'SHARED' ? 'shared' : 'exclusive'})</span>
            </div>
          ))}
        </td>
        <td style={{ padding: '10px 8px' }}>
          <button className="btn btn-bronze" onClick={onToggle} style={{ fontSize: '0.82rem', padding: '6px 12px' }}>
            {expanded ? 'Close' : 'Allocate'}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={5} style={{ padding: '14px 8px', background: 'var(--off-white, #faf9f7)' }}>
            {error && <div className="disclaimer-box" style={{ marginBottom: 12 }}>{error}</div>}

            {(!lead.live_allocations || lead.live_allocations.length === 0) && (
              <p className="form-note" style={{ marginBottom: 14 }}>
                {isAppointment ? 'This is a booked appointment.' : 'This is a verified enquiry.'}{' '}
                <button type="button" onClick={changeLeadType} disabled={submitting}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'var(--bronze)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>
                  {isAppointment ? 'Change to a verified enquiry' : 'Change to a booked appointment'}
                </button>{' '}
                (only possible before it has been allocated).
              </p>
            )}

            <h4 style={{ fontSize: '0.95rem', marginBottom: 8 }}>
              Step 1 &mdash; Record homeowner confirmation {lastConfirmationId && <span style={{ color: '#2f4a33' }}>(recorded, confirmation #{lastConfirmationId})</span>}
            </h4>
            <p className="form-note">
              Mandatory before any offer, and needed separately for each business this lead is
              shared with &mdash; recording a YES for one buyer is never evidence of consent to
              share with another. This must be a lead-specific, named-business confirmation,
              covering that this enquiry may be passed to more than one business if that applies
              &mdash; not inferred from the enquiry form's general consent checkbox.
            </p>
            <form onSubmit={recordConfirmation} style={{ marginBottom: 20 }}>
              <div className="form-row">
                <label>Buyer being named to the homeowner</label>
                <select value={confirmBuyerId} onChange={(e) => setConfirmBuyerId(e.target.value)} required>
                  <option value="">Select buyer</option>
                  {industryBuyers.map((b) => <option key={b.id} value={b.id}>{b.company_name}</option>)}
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
            <p className="form-note">
              Multi-buyer distribution is the normal model now, not an exception &mdash; a lead can
              go to more than one matched buyer. The buyer list below is narrowed to those matched
              by coverage and remaining weekly capacity; it is a suggestion, not a hard limit.
            </p>
            {lead.live_allocations && lead.live_allocations.length > 0 && (
              <div className="disclaimer-box" style={{ marginBottom: 12 }}>
                Already receiving this lead: {lead.live_allocations.map((a) => a.company_name).join(', ')}.
                A new homeowner confirmation naming the next business is still required above before
                allocating to them too.
              </div>
            )}
            <form onSubmit={allocate}>
              <div className="form-row">
                <label>Buyer</label>
                <select value={allocBuyerId} onChange={(e) => onAllocBuyerChange(e.target.value)} required>
                  <option value="">Select buyer</option>
                  {allocOptions.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.company_name} ({isAppointment ? `£${b.agreed_price_per_appointment ?? '?'}/appointment` : `£${b.agreed_price_per_lead ?? '?'}/lead`})
                    </option>
                  ))}
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', color: 'var(--slate)', marginBottom: 12 }}>
                <input type="checkbox" checked={showAllBuyers} onChange={(e) => setShowAllBuyers(e.target.checked)} style={{ width: 'auto' }} />
                Not seeing who you expected? Show all ACTIVE buyers in this industry, matched or not.
              </label>
              {isAppointment ? (
                <>
                  <p className="form-note">
                    A booked appointment goes to this one buyer only. Record the date and time the homeowner
                    agreed on the phone; the buyer sees it in their emails.
                  </p>
                  <div className="form-row">
                    <label>Appointment date and time (UK time)</label>
                    <input type="datetime-local" value={apptAt} onChange={(e) => setApptAt(e.target.value)} required />
                  </div>
                  <div className="form-row">
                    <label>How</label>
                    <select value={apptKind} onChange={(e) => setApptKind(e.target.value as typeof apptKind)}>
                      <option value="IN_PERSON">In person at the property</option>
                      <option value="PHONE">Phone call</option>
                      <option value="VIDEO">Video call</option>
                    </select>
                  </div>
                  <div className="form-row">
                    <label>Where / notes for the buyer (optional, no homeowner contact details here)</label>
                    <input value={apptWhere} onChange={(e) => setApptWhere(e.target.value)} placeholder="e.g. at the property; side gate" />
                  </div>
                  <div className="form-row">
                    <label>When the homeowner agreed this time</label>
                    <input type="datetime-local" value={apptConfirmedAt} onChange={(e) => setApptConfirmedAt(e.target.value)} required />
                  </div>
                </>
              ) : (
              <div className="form-row">
                <label>Allocation type</label>
                <select value={allocationType} onChange={(e) => { setAllocationTypeTouched(true); setAllocationType(e.target.value as typeof allocationType); }}>
                  <option value="SHARED">Shared &mdash; sold to more than one buyer at once (default)</option>
                  <option value="EXCLUSIVE_WINDOW">Exclusive &mdash; one buyer only</option>
                </select>
                <p className="form-note" style={{ marginTop: 4 }}>
                  Follows the selected buyer's own agreed arrangement automatically; only override this
                  if you're deliberately going against what's on file for them.
                </p>
              </div>
              )}
              <div className="form-row">
                <label>Free replacement for request # (optional)</label>
                <input value={replacementRequestId} inputMode="numeric" onChange={(e) => setReplacementRequestId(e.target.value.replace(/\D/g, ''))} placeholder="Leave blank for a normal sale" />
                <p className="form-note" style={{ marginTop: 4 }}>
                  Only for an approved replacement request on a pay-per-lead lead (see Credits &amp; Replacements). No
                  payment is taken and the lead is released straight away.
                </p>
              </div>
              {!replacementRequestId && (
                <div className="form-row">
                  <label>Unique payment link for this lead</label>
                  <input value={paymentLink} onChange={(e) => setPaymentLink(e.target.value)} placeholder="https://pay.tide.co/products/..." />
                </div>
              )}
              <button className="btn btn-bronze" type="submit" disabled={submitting || !allocBuyerId || !lastConfirmationId || (isAppointment && (!apptAt || !apptConfirmedAt))}>
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

'use client';

import { useState } from 'react';
import { apiPath } from '../../lib/basePath';

type Answers = Record<string, string | boolean | number | string[] | undefined>;

function TextField({
  label, name, type = 'text', required, hint, value, onChange,
}: { label: string; name: string; type?: string; required?: boolean; hint?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="form-row">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="form-note" style={{ textAlign: 'left', marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

function TextAreaField({
  label, name, value, onChange, hint,
}: { label: string; name: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <div className="form-row">
      <label htmlFor={name}>{label}</label>
      <textarea id={name} name={name} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="form-note" style={{ textAlign: 'left', marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

function SelectField({
  label, name, options, value, onChange, required,
}: { label: string; name: string; options: string[]; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div className="form-row">
      <label htmlFor={name}>{label}</label>
      <select id={name} name={name} required={required} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select one</option>
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function YesNo({
  label, name, value, onChange,
}: { label: string; name: string; value: boolean | undefined; onChange: (v: boolean) => void }) {
  return (
    <div className="form-row">
      <label>{label}</label>
      <div style={{ display: 'flex', gap: 16 }}>
        <label style={{ fontWeight: 400, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="radio" name={name} checked={value === true} onChange={() => onChange(true)} /> Yes
        </label>
        <label style={{ fontWeight: 400, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input type="radio" name={name} checked={value === false} onChange={() => onChange(false)} /> No
        </label>
      </div>
    </div>
  );
}

function Checkbox({
  label, name, checked, onChange,
}: { label: string; name: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="form-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <input type="checkbox" id={name} name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 'auto', marginTop: 3 }} />
      <label htmlFor={name} style={{ fontWeight: 400, fontSize: '0.9rem', marginBottom: 0 }}>{label}</label>
    </div>
  );
}

export default function BuyerApplicationForm() {
  const [a, setA] = useState<Answers>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ reference: string; status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, value: Answers[string]) => setA((prev) => ({ ...prev, [key]: value }));
  const str = (key: string) => (typeof a[key] === 'string' ? (a[key] as string) : '');
  const bool = (key: string) => (typeof a[key] === 'boolean' ? (a[key] as boolean) : undefined);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const required = [
      'company_name', 'contact_name', 'contact_email', 'telephone',
    ];
    for (const f of required) {
      if (!str(f)) {
        setError('Please fill in all business profile fields before submitting.');
        return;
      }
    }
    const consents = [
      'confirmed_info_accurate', 'confirmed_can_deliver_services', 'agreed_buyer_terms',
      'acknowledged_replacement_policy', 'confirmed_payment_before_release_understanding',
      'agreed_pii_handling', 'agreed_account_notifications',
    ];
    for (const f of consents) {
      if (bool(f) !== true) {
        setError('Please confirm all required terms and acknowledgements before submitting.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        ...a,
        services_offered: str('services_offered').split(',').map((s) => s.trim()).filter(Boolean),
        counties_covered: str('counties_covered').split(',').map((s) => s.trim()).filter(Boolean),
        postcodes_covered: str('postcodes_covered').split(',').map((s) => s.trim()).filter(Boolean),
        property_types_accepted: str('property_types_accepted').split(',').map((s) => s.trim()).filter(Boolean),
        weekly_lead_capacity: a.weekly_lead_capacity ? Number(a.weekly_lead_capacity) : undefined,
        preferred_monthly_volume: a.preferred_monthly_volume ? Number(a.preferred_monthly_volume) : undefined,
        max_travel_distance_miles: a.max_travel_distance_miles ? Number(a.max_travel_distance_miles) : undefined,
        min_project_value: a.min_project_value ? Number(a.min_project_value) : undefined,
        max_project_value: a.max_project_value ? Number(a.max_project_value) : undefined,
        preferred_price_range_low: a.preferred_price_range_low ? Number(a.preferred_price_range_low) : undefined,
        preferred_price_range_high: a.preferred_price_range_high ? Number(a.preferred_price_range_high) : undefined,
        previous_price_paid_per_lead: a.previous_price_paid_per_lead ? Number(a.previous_price_paid_per_lead) : undefined,
        previous_leads_worthwhile_pct: a.previous_leads_worthwhile_pct ? Number(a.previous_leads_worthwhile_pct) : undefined,
        surveys_per_week_capacity: a.surveys_per_week_capacity ? Number(a.surveys_per_week_capacity) : undefined,
        typical_qualified_to_job_conversion_pct: a.typical_qualified_to_job_conversion_pct ? Number(a.typical_qualified_to_job_conversion_pct) : undefined,
        avg_revenue_per_completed_job: a.avg_revenue_per_completed_job ? Number(a.avg_revenue_per_completed_job) : undefined,
      };

      const res = await fetch(apiPath('/api/buyer-applications'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Submission failed. Please try again.');
        setSubmitting(false);
        return;
      }
      setResult({ reference: data.application_reference, status: data.application_status });
    } catch {
      setError('Submission failed — please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="form-card" style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: 12 }}>Application received</h2>
        <p>
          Your reference: <strong>{result.reference}</strong>
          <br />
          Status: <strong>{result.status.replace('_', ' ')}</strong>
        </p>
        <p style={{ color: 'var(--slate)' }}>
          Registering does not grant access to lead inventory or homeowner details. An admin reviews
          every application before approval. We&rsquo;ll be in touch using the contact details you
          provided.
        </p>
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      {error && (
        <div style={{ background: '#F2E2DE', color: '#8C4438', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <h3 style={{ fontSize: '1.05rem', marginBottom: 12 }}>1. Business profile</h3>
      <TextField label="Company name" name="company_name" required value={str('company_name')} onChange={(v) => set('company_name', v)} />
      <TextField label="Contact name" name="contact_name" required value={str('contact_name')} onChange={(v) => set('contact_name', v)} />
      <TextField label="Business email" name="contact_email" type="email" required value={str('contact_email')} onChange={(v) => set('contact_email', v)} />
      <TextField label="Telephone number" name="telephone" type="tel" required value={str('telephone')} onChange={(v) => set('telephone', v)} />
      <TextField label="Website" name="website" type="url" value={str('website')} onChange={(v) => set('website', v)} />
      <TextField label="Company registration number (if applicable)" name="company_registration_number" value={str('company_registration_number')} onChange={(v) => set('company_registration_number', v)} />
      <TextField label="How long have you been operating?" name="years_operating" value={str('years_operating')} onChange={(v) => set('years_operating', v)} />
      <TextField label="Where is your business based?" name="business_location" value={str('business_location')} onChange={(v) => set('business_location', v)} />

      <h3 style={{ fontSize: '1.05rem', margin: '28px 0 12px' }}>2. Services and capability</h3>
      <TextField label="Services offered" name="services_offered" value={str('services_offered')} onChange={(v) => set('services_offered', v)} hint="Comma-separated, e.g. open-cell removal, closed-cell removal, loft insulation removal" />
      <YesNo label="Do you carry out the work yourselves (rather than subcontracting)?" name="does_own_fulfilment" value={bool('does_own_fulfilment')} onChange={(v) => set('does_own_fulfilment', v)} />
      <YesNo label="Do you have the necessary insurance and relevant qualifications for the services you offer?" name="has_required_insurance_and_quals" value={bool('has_required_insurance_and_quals')} onChange={(v) => set('has_required_insurance_and_quals', v)} />

      <h3 style={{ fontSize: '1.05rem', margin: '28px 0 12px' }}>3. Geographic coverage</h3>
      <TextField label="Counties covered" name="counties_covered" value={str('counties_covered')} onChange={(v) => set('counties_covered', v)} hint="Comma-separated" />
      <TextField label="Postcodes covered" name="postcodes_covered" value={str('postcodes_covered')} onChange={(v) => set('postcodes_covered', v)} hint="Comma-separated, e.g. CM, SS, CO" />
      <SelectField label="Coverage type" name="coverage_type" options={['National', 'Regional']} value={str('coverage_type')} onChange={(v) => set('coverage_type', v)} />
      <TextField label="Areas you specifically don't service" name="excluded_areas" value={str('excluded_areas')} onChange={(v) => set('excluded_areas', v)} />
      <TextField label="Maximum travel distance (miles)" name="max_travel_distance_miles" type="number" value={str('max_travel_distance_miles')} onChange={(v) => set('max_travel_distance_miles', v)} />

      <h3 style={{ fontSize: '1.05rem', margin: '28px 0 12px' }}>4. Lead requirements</h3>
      <TextField label="How many new enquiries could you comfortably handle each week?" name="weekly_lead_capacity" type="number" value={str('weekly_lead_capacity')} onChange={(v) => set('weekly_lead_capacity', v)} />
      <TextField label="Preferred monthly lead volume" name="preferred_monthly_volume" type="number" value={str('preferred_monthly_volume')} onChange={(v) => set('preferred_monthly_volume', v)} />
      <SelectField label="Steady flow or occasional additional enquiries?" name="volume_preference" options={['Steady flow', 'Occasional']} value={str('volume_preference')} onChange={(v) => set('volume_preference', v)} />
      <YesNo label="Do you accept enquiries where the homeowner is still researching options (longer-term prospects)?" name="accepts_long_term_prospects" value={bool('accepts_long_term_prospects')} onChange={(v) => set('accepts_long_term_prospects', v)} />
      <TextField label="Property types you accept" name="property_types_accepted" value={str('property_types_accepted')} onChange={(v) => set('property_types_accepted', v)} hint="Comma-separated" />
      <TextField label="Minimum project value you'll take on (£)" name="min_project_value" type="number" value={str('min_project_value')} onChange={(v) => set('min_project_value', v)} />
      <TextField label="Maximum project value, if relevant (£)" name="max_project_value" type="number" value={str('max_project_value')} onChange={(v) => set('max_project_value', v)} />

      <h3 style={{ fontSize: '1.05rem', margin: '28px 0 12px' }}>5. Existing lead-buying experience</h3>
      <YesNo label="Have you purchased leads from external suppliers before?" name="has_bought_leads_before" value={bool('has_bought_leads_before')} onChange={(v) => set('has_bought_leads_before', v)} />
      <TextField label="Which lead providers have you used?" name="previous_lead_providers" value={str('previous_lead_providers')} onChange={(v) => set('previous_lead_providers', v)} />
      <SelectField label="Were those leads exclusive or shared?" name="previous_leads_exclusive_or_shared" options={['Exclusive', 'Shared', 'Mixed']} value={str('previous_leads_exclusive_or_shared')} onChange={(v) => set('previous_leads_exclusive_or_shared', v)} />
      <TextField label="What did you typically pay per lead (£)?" name="previous_price_paid_per_lead" type="number" value={str('previous_price_paid_per_lead')} onChange={(v) => set('previous_price_paid_per_lead', v)} />
      <TextField label="What percentage of leads were genuinely worthwhile?" name="previous_leads_worthwhile_pct" type="number" value={str('previous_leads_worthwhile_pct')} onChange={(v) => set('previous_leads_worthwhile_pct', v)} hint="One of the three questions we weight most heavily" />
      <TextAreaField label="What problems have you experienced with previous suppliers?" name="previous_supplier_problems" value={str('previous_supplier_problems')} onChange={(v) => set('previous_supplier_problems', v)} />
      <TextAreaField label="What would make you consider a lead supplier reliable?" name="reliability_criteria" value={str('reliability_criteria')} onChange={(v) => set('reliability_criteria', v)} />

      <h3 style={{ fontSize: '1.05rem', margin: '28px 0 12px' }}>6. Commercial preferences</h3>
      <SelectField label="Exclusive or shared leads?" name="exclusivity_preference" options={['Exclusive', 'Shared', 'Either']} value={str('exclusivity_preference')} onChange={(v) => set('exclusivity_preference', v)} />
      <TextField label="Price range you'd consider reasonable, low (£)" name="preferred_price_range_low" type="number" value={str('preferred_price_range_low')} onChange={(v) => set('preferred_price_range_low', v)} />
      <TextField label="Price range you'd consider reasonable, high (£)" name="preferred_price_range_high" type="number" value={str('preferred_price_range_high')} onChange={(v) => set('preferred_price_range_high', v)} />
      <SelectField label="Purchase individually or to an agreed weekly volume?" name="purchase_model_preference" options={['Per lead', 'Agreed weekly volume']} value={str('purchase_model_preference')} onChange={(v) => set('purchase_model_preference', v)} />

      <h3 style={{ fontSize: '1.05rem', margin: '28px 0 12px' }}>7. Sales process and capacity</h3>
      <TextField label="Who handles incoming enquiries?" name="who_handles_enquiries" value={str('who_handles_enquiries')} onChange={(v) => set('who_handles_enquiries', v)} />
      <YesNo label="Do you have a dedicated sales team?" name="has_dedicated_sales_team" value={bool('has_dedicated_sales_team')} onChange={(v) => set('has_dedicated_sales_team', v)} />
      <YesNo label="Can you contact new enquiries during normal business hours?" name="can_contact_during_business_hours" value={bool('can_contact_during_business_hours')} onChange={(v) => set('can_contact_during_business_hours', v)} />
      <TextField label="What's your typical first-response time?" name="typical_first_response_time" value={str('typical_first_response_time')} onChange={(v) => set('typical_first_response_time', v)} hint="e.g. same day, within 2 hours, next business day" />
      <TextField label="How many surveys or quotations can you complete per week?" name="surveys_per_week_capacity" type="number" value={str('surveys_per_week_capacity')} onChange={(v) => set('surveys_per_week_capacity', v)} />
      <TextField label="Approximately what percentage of qualified enquiries become paying jobs?" name="typical_qualified_to_job_conversion_pct" type="number" value={str('typical_qualified_to_job_conversion_pct')} onChange={(v) => set('typical_qualified_to_job_conversion_pct', v)} />
      <TextField label="What is your average revenue or gross profit from a completed job (£)?" name="avg_revenue_per_completed_job" type="number" value={str('avg_revenue_per_completed_job')} onChange={(v) => set('avg_revenue_per_completed_job', v)} hint="One of the three questions we weight most heavily" />

      <h3 style={{ fontSize: '1.05rem', margin: '28px 0 12px' }}>8. Terms and verification</h3>
      <Checkbox label="I confirm the business information provided is accurate." name="confirmed_info_accurate" checked={bool('confirmed_info_accurate') ?? false} onChange={(v) => set('confirmed_info_accurate', v)} />
      <Checkbox label="I confirm the business can provide the advertised services." name="confirmed_can_deliver_services" checked={bool('confirmed_can_deliver_services') ?? false} onChange={(v) => set('confirmed_can_deliver_services', v)} />
      <Checkbox label="I agree to the Buyer Terms." name="agreed_buyer_terms" checked={bool('agreed_buyer_terms') ?? false} onChange={(v) => set('agreed_buyer_terms', v)} />
      <Checkbox label="I acknowledge the Lead Replacement Policy." name="acknowledged_replacement_policy" checked={bool('acknowledged_replacement_policy') ?? false} onChange={(v) => set('acknowledged_replacement_policy', v)} />
      <Checkbox label="I understand leads are paid for before contact details are released (payment-before-release model)." name="confirmed_payment_before_release_understanding" checked={bool('confirmed_payment_before_release_understanding') ?? false} onChange={(v) => set('confirmed_payment_before_release_understanding', v)} />
      <Checkbox label="I agree to appropriate handling of homeowner personal information." name="agreed_pii_handling" checked={bool('agreed_pii_handling') ?? false} onChange={(v) => set('agreed_pii_handling', v)} />
      <Checkbox label="I agree to receive relevant account and lead notifications." name="agreed_account_notifications" checked={bool('agreed_account_notifications') ?? false} onChange={(v) => set('agreed_account_notifications', v)} />
      <Checkbox label="(Optional) I'd also like to receive occasional marketing updates from Halo Strategic." name="marketing_consent" checked={bool('marketing_consent') ?? false} onChange={(v) => set('marketing_consent', v)} />

      <button type="submit" className="btn btn-bronze btn-wide" disabled={submitting} style={{ marginTop: 16 }}>
        {submitting ? 'Submitting…' : 'Submit Application'}
      </button>
      <p className="form-note">
        Submitting this form does not grant access to lead inventory. An administrator reviews every
        application before approval.
      </p>
    </form>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiPath } from '../../../lib/basePath';
import { HOMEOWNER_CONSENT_CONFIG } from '../../../lib/industries';

type Answers = Record<string, string | boolean | undefined>;

function TextField({
  label, name, type = 'text', required, value, onChange,
}: { label: string; name: string; type?: string; required?: boolean; value: string; onChange: (v: string) => void }) {
  return (
    <div className="form-row">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} />
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

function Checkbox({
  label, name, checked, onChange, required,
}: { label: React.ReactNode; name: string; checked: boolean; onChange: (v: boolean) => void; required?: boolean }) {
  return (
    <div className="form-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <input type="checkbox" id={name} name={name} required={required} checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 'auto', marginTop: 3 }} />
      <label htmlFor={name} style={{ fontWeight: 400, fontSize: '0.9rem', marginBottom: 0 }}>{label}</label>
    </div>
  );
}

export default function RequestQuoteForm() {
  const [a, setA] = useState<Answers>({});
  const [botField, setBotField] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ reference: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, value: Answers[string]) => setA((prev) => ({ ...prev, [key]: value }));
  const str = (key: string) => (typeof a[key] === 'string' ? (a[key] as string) : '');
  const bool = (key: string) => (typeof a[key] === 'boolean' ? (a[key] as boolean) : false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const required = ['first_name', 'last_name', 'email', 'mobile', 'postcode', 'ownership_status', 'property_type'];
    for (const f of required) {
      if (!str(f)) {
        setError('Please fill in all required fields before submitting.');
        return;
      }
    }
    if (!bool('consent_contact') || !bool('consent_share_buyer') || !bool('privacy_consent')) {
      setError('Please confirm all three required consents before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(apiPath('/api/homeowner-enquiries'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...a, industry_slug: 'solar_battery', bot_field: botField }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Submission failed. Please try again.');
        setSubmitting(false);
        return;
      }
      setResult({ reference: data.reference });
    } catch {
      setError('Submission failed — please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="form-card" style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.3rem', marginBottom: 12 }}>Enquiry received</h2>
        <p>
          Your reference: <strong>{result.reference}</strong>
        </p>
        <p style={{ color: 'var(--slate)' }}>
          We only share your details with a suitable installer if you asked us to, and only after we
          judge your enquiry a genuine fit. We&rsquo;ll be in touch using the details you provided.
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

      <p style={{ display: 'none' }}>
        <label>
          Don&rsquo;t fill this out if you&rsquo;re human:
          <input value={botField} onChange={(e) => setBotField(e.target.value)} />
        </label>
      </p>

      <h3 style={{ fontSize: '1.05rem', marginBottom: 12 }}>Your details</h3>
      <TextField label="First name" name="first_name" required value={str('first_name')} onChange={(v) => set('first_name', v)} />
      <TextField label="Last name" name="last_name" required value={str('last_name')} onChange={(v) => set('last_name', v)} />
      <TextField label="Email" name="email" type="email" required value={str('email')} onChange={(v) => set('email', v)} />
      <TextField label="Mobile number" name="mobile" type="tel" required value={str('mobile')} onChange={(v) => set('mobile', v)} />
      <SelectField
        label="Preferred contact method"
        name="preferred_contact_method"
        options={['Phone', 'Email', 'Text message']}
        value={str('preferred_contact_method')}
        onChange={(v) => set('preferred_contact_method', v)}
      />
      <TextField label="UK postcode" name="postcode" required value={str('postcode')} onChange={(v) => set('postcode', v)} />
      <SelectField
        label="Property ownership status"
        name="ownership_status"
        required
        options={['I own this property', 'I rent this property', 'Other']}
        value={str('ownership_status')}
        onChange={(v) => set('ownership_status', v)}
      />
      <SelectField
        label="Property type"
        name="property_type"
        required
        options={['Detached house', 'Semi-detached house', 'Terraced house', 'Bungalow', 'Flat/apartment', 'Other']}
        value={str('property_type')}
        onChange={(v) => set('property_type', v)}
      />

      <h3 style={{ fontSize: '1.05rem', margin: '24px 0 12px' }}>About your project</h3>
      <SelectField
        label="What are you interested in?"
        name="interest_type"
        options={['Solar panels only', 'Battery storage only', 'Both solar panels and battery storage', 'Not sure yet']}
        value={str('interest_type')}
        onChange={(v) => set('interest_type', v)}
      />
      <SelectField
        label="Roof type, if known"
        name="roof_type"
        options={['Pitched roof', 'Flat roof', 'Mixed / not sure']}
        value={str('roof_type')}
        onChange={(v) => set('roof_type', v)}
      />
      <SelectField
        label="Do you already have solar installed?"
        name="existing_solar"
        options={['No', 'Yes, looking to add battery storage', 'Yes, looking to expand or replace']}
        value={str('existing_solar')}
        onChange={(v) => set('existing_solar', v)}
      />
      <SelectField
        label="How soon are you looking to act?"
        name="timeframe"
        options={['As soon as possible', 'Within 1 month', 'Within 3 months', 'Just researching for now']}
        value={str('timeframe')}
        onChange={(v) => set('timeframe', v)}
      />

      <h3 style={{ fontSize: '1.05rem', margin: '24px 0 12px' }}>Your consent</h3>
      <Checkbox
        label="I'm happy for Halo Strategic to contact me about this enquiry, using the details above."
        name="consent_contact"
        required
        checked={bool('consent_contact')}
        onChange={(v) => set('consent_contact', v)}
      />
      <Checkbox
        label={HOMEOWNER_CONSENT_CONFIG.solar_battery.shareBuyerLabel}
        name="consent_share_buyer"
        required
        checked={bool('consent_share_buyer')}
        onChange={(v) => set('consent_share_buyer', v)}
      />
      <Checkbox
        label={
          <>
            I have read and agree to Halo Strategic&rsquo;s{' '}
            <Link href="/privacy-policy" style={{ color: 'var(--bronze)' }}>Privacy Policy</Link>.
          </>
        }
        name="privacy_consent"
        required
        checked={bool('privacy_consent')}
        onChange={(v) => set('privacy_consent', v)}
      />
      <Checkbox
        label="(Optional) I'd also like to receive occasional home-improvement tips and updates from Halo Strategic by email."
        name="marketing_consent"
        checked={bool('marketing_consent')}
        onChange={(v) => set('marketing_consent', v)}
      />

      <p className="form-note" style={{ marginTop: 12 }}>
        We don&rsquo;t share your details with anyone unless you&rsquo;ve given your consent to that
        specifically, and we don&rsquo;t bundle that consent in with agreeing to our Privacy Policy or
        with any marketing preference — they&rsquo;re separate choices above.
      </p>

      <button type="submit" className="btn btn-bronze" disabled={submitting} style={{ marginTop: 20 }}>
        {submitting ? 'Submitting…' : 'Submit enquiry'}
      </button>
    </form>
  );
}

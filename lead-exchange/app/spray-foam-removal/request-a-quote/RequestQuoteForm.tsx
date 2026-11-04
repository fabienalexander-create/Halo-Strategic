'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiPath } from '../../../lib/basePath';

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
  label, name, checked, onChange,
}: { label: React.ReactNode; name: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="form-row" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <input type="checkbox" id={name} name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 'auto', marginTop: 3 }} />
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
        body: JSON.stringify({ ...a, bot_field: botField }),
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
          We only share your details with a suitable business if you asked us to, and only after we
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

      <h3 style={{ fontSize: '1.05rem', margin: '24px 0 12px' }}>About the spray foam</h3>
      <SelectField
        label="Where is the spray foam?"
        name="foam_location"
        options={['Loft/roof space', 'Walls', 'Both', 'Not sure']}
        value={str('foam_location')}
        onChange={(v) => set('foam_location', v)}
      />
      <SelectField
        label="Type of spray foam, if known"
        name="foam_type"
        options={['Open-cell', 'Closed-cell', 'Not sure']}
        value={str('foam_type')}
        onChange={(v) => set('foam_type', v)}
      />
      <SelectField
        label="Why are you looking to remove it?"
        name="reason_for_removal"
        options={['Mortgage or sale issue', 'Damp or ventilation concern', 'Planning to re-roof', 'Other']}
        value={str('reason_for_removal')}
        onChange={(v) => set('reason_for_removal', v)}
      />
      <SelectField
        label="How soon are you looking to act?"
        name="timeframe"
        options={['As soon as possible', 'Within 1 month', 'Within 3 months', 'Just researching for now']}
        value={str('timeframe')}
        onChange={(v) => set('timeframe', v)}
      />
      <SelectField
        label="Roof access"
        name="roof_access"
        options={['Easy loft hatch access', 'Difficult or restricted access', 'Not sure']}
        value={str('roof_access')}
        onChange={(v) => set('roof_access', v)}
      />
      <SelectField
        label="Have you had a previous inspection or quote for this?"
        name="previous_quotes"
        options={['Yes', 'No']}
        value={str('previous_quotes')}
        onChange={(v) => set('previous_quotes', v)}
      />

      <h3 style={{ fontSize: '1.05rem', margin: '24px 0 12px' }}>Your consent</h3>
      <Checkbox
        label="I'm happy for Halo Strategic to contact me about this enquiry, using the details above."
        name="consent_contact"
        checked={bool('consent_contact')}
        onChange={(v) => set('consent_contact', v)}
      />
      <Checkbox
        label="I'm happy for my details to be shared with a suitable spray foam removal business, so they can contact me about this enquiry, if Halo Strategic identifies one as a genuine fit."
        name="consent_share_buyer"
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

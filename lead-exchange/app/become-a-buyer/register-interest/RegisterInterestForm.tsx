'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiPath } from '../../../lib/basePath';

type Answers = Record<string, string | boolean | undefined>;

const INDUSTRY_OPTIONS = ['Spray Foam Removal', 'Solar & Battery', 'Roofing'];
const INDUSTRY_SLUGS: Record<string, string> = {
  'Spray Foam Removal': 'spray_foam_removal',
  'Solar & Battery': 'solar_battery',
  Roofing: 'roofing',
};

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

export default function RegisterInterestForm() {
  const [a, setA] = useState<Answers>({});
  const [industryLabel, setIndustryLabel] = useState('');
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

    const required = ['company_name', 'contact_name', 'contact_email', 'telephone'];
    for (const f of required) {
      if (!str(f)) {
        setError('Please fill in all required fields before submitting.');
        return;
      }
    }
    if (!industryLabel) {
      setError('Please select which industry you operate in.');
      return;
    }
    if (!bool('consent_contact')) {
      setError('Please confirm you’re happy for us to contact you about this.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(apiPath('/api/buyer-prospects'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...a,
          industry_slug: INDUSTRY_SLUGS[industryLabel],
          bot_field: botField,
          referrer: typeof document !== 'undefined' ? document.referrer : undefined,
          utm_source: new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('utm_source') ?? undefined,
          utm_medium: new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('utm_medium') ?? undefined,
          utm_campaign: new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('utm_campaign') ?? undefined,
        }),
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
        <h2 style={{ fontSize: '1.3rem', marginBottom: 12 }}>Thanks — we&rsquo;ve got your details</h2>
        <p>
          Your reference: <strong>{result.reference}</strong>
        </p>
        <p style={{ color: 'var(--slate)' }}>
          We&rsquo;ll be in touch shortly with more information. If you&rsquo;d rather get started
          right away, you can go straight to the{' '}
          <Link href="/become-a-buyer/apply" style={{ color: 'var(--bronze)' }}>full application</Link>.
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

      <TextField label="Company name" name="company_name" required value={str('company_name')} onChange={(v) => set('company_name', v)} />
      <TextField label="Contact name" name="contact_name" required value={str('contact_name')} onChange={(v) => set('contact_name', v)} />
      <TextField label="Business email" name="contact_email" type="email" required value={str('contact_email')} onChange={(v) => set('contact_email', v)} />
      <TextField label="Phone number" name="telephone" type="tel" required value={str('telephone')} onChange={(v) => set('telephone', v)} />
      <SelectField label="Which industry are you in?" name="industry" required options={INDUSTRY_OPTIONS} value={industryLabel} onChange={setIndustryLabel} />
      <TextField
        label="Postcodes or areas covered"
        name="postcodes_covered"
        value={str('postcodes_covered')}
        onChange={(v) => set('postcodes_covered', v)}
      />
      <TextField
        label="Approximate monthly lead requirement"
        name="approx_monthly_lead_requirement"
        value={str('approx_monthly_lead_requirement')}
        onChange={(v) => set('approx_monthly_lead_requirement', v)}
      />

      <h3 style={{ fontSize: '1.05rem', margin: '24px 0 12px' }}>Your consent</h3>
      <Checkbox
        label="I'm happy for Halo Strategic to contact me about the Lead Exchange, using the details above."
        name="consent_contact"
        required
        checked={bool('consent_contact')}
        onChange={(v) => set('consent_contact', v)}
      />
      <Checkbox
        label="(Optional) I'd also like to receive occasional marketing updates from Halo Strategic by email."
        name="marketing_consent"
        checked={bool('marketing_consent')}
        onChange={(v) => set('marketing_consent', v)}
      />

      <p className="form-note" style={{ marginTop: 12 }}>
        This is a short registration, not an application &mdash; it doesn&rsquo;t grant lead
        inventory or account access. Marketing emails are optional and off by default, and separate
        from being contacted about this registration.
      </p>

      <button type="submit" className="btn btn-bronze" disabled={submitting} style={{ marginTop: 20 }}>
        {submitting ? 'Submitting…' : 'Register your interest'}
      </button>
    </form>
  );
}

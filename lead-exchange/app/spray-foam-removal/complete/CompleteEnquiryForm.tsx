'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiPath } from '../../../lib/basePath';
import { HOMEOWNER_CONSENT_CONFIG } from '../../../lib/industries';

type Answers = Record<string, string | boolean | undefined>;

// Deliberately does nothing on page load / GET -- same reasoning as
// app/become-a-buyer/unsubscribe/UnsubscribeForm.tsx: some corporate email security scanners
// "click" every link in an incoming message. The token is only ever sent once the visitor fills
// in and explicitly submits this form.
function Choice({
  label, options, value, onChange,
}: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="form-row">
      <label>{label}</label>
      <div style={{ display: 'grid', gap: 8 }}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className="btn"
            style={{
              textAlign: 'left',
              background: value === o ? 'var(--bronze-light)' : 'var(--surface)',
              border: `1px solid ${value === o ? 'var(--bronze)' : 'var(--border)'}`,
              color: 'var(--ink)',
              fontWeight: value === o ? 600 : 400,
            }}
          >
            {o}
          </button>
        ))}
      </div>
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

function TextField({
  label, name, required, value, onChange,
}: { label: string; name: string; required?: boolean; value: string; onChange: (v: string) => void }) {
  return (
    <div className="form-row">
      <label htmlFor={name}>{label}</label>
      <input id={name} name={name} type="text" required={required} value={value} onChange={(e) => onChange(e.target.value)} />
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

const REASON_OPTIONS = [
  'Mortgage or remortgage concerns',
  'Selling the property',
  'Surveyor has raised an issue',
  'Damp or ventilation concerns',
  'General maintenance',
  'Other',
];
const TIMEFRAME_OPTIONS = ['As soon as possible', 'Within 1 month', 'Within 3 months', 'Within 6 months', 'Just researching for now'];
const CONTACT_METHOD_OPTIONS = ['Phone', 'Email', 'Text message'];

export default function CompleteEnquiryForm() {
  const [token] = useState(() => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') ?? '' : ''));
  const [a, setA] = useState<Answers>({});
  const [botField, setBotField] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ reference: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dead, setDead] = useState(false); // token invalid/expired/used -- distinct from a retryable error

  const set = (key: string, value: Answers[string]) => setA((prev) => ({ ...prev, [key]: value }));
  const str = (key: string) => (typeof a[key] === 'string' ? (a[key] as string) : '');
  const bool = (key: string) => (typeof a[key] === 'boolean' ? (a[key] as boolean) : false);

  if (!token) {
    return <p>This link is missing a required code. Please use the link we sent you to finish your enquiry.</p>;
  }

  if (result) {
    return (
      <div className="form-card">
        <h2 style={{ fontSize: '1.3rem', marginBottom: 4 }}>Thanks &mdash; that&rsquo;s everything we need.</h2>
        <p style={{ marginBottom: 16 }}>
          Your reference: <strong>{result.reference}</strong>
        </p>
        <p className="form-note" style={{ textAlign: 'left' }}>
          We&rsquo;ll review your enquiry and, where you&rsquo;ve given us permission to, introduce you
          to a suitable specialist. We&rsquo;ll be in touch using the details you already gave us.
        </p>
      </div>
    );
  }

  if (dead) {
    return (
      <div className="form-card">
        <p>This link is no longer valid. It may have expired or already been used.</p>
        <p className="form-note" style={{ textAlign: 'left', marginTop: 12 }}>
          If you still want to go ahead, you can start a fresh enquiry instead.
        </p>
        <Link href="/spray-foam-removal/request-a-quote" className="btn btn-bronze" style={{ display: 'inline-block', marginTop: 8 }}>
          Start a new enquiry
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const required = ['reason_for_enquiry', 'timeframe', 'preferred_contact_method'];
    for (const f of required) {
      if (!str(f)) {
        setError('Please answer all three required questions before submitting.');
        return;
      }
    }
    if (!bool('consent_contact') || !bool('consent_share_buyer') || !bool('privacy_consent')) {
      setError('Please confirm all three required consents before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(apiPath('/api/homeowner-enquiries/complete'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...a, token, bot_field: botField }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 410) {
          setDead(true);
          return;
        }
        setError(data.error ?? 'Submission failed. Please try again.');
        return;
      }
      setResult({ reference: data.reference });
    } catch {
      setError('Submission failed — please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
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

      <p className="form-note" style={{ textAlign: 'left', marginBottom: 16 }}>
        Thanks for your enquiry. We just need a few more details before we can put you in touch
        with a suitable specialist.
      </p>

      <h3 style={{ fontSize: '1.05rem', marginBottom: 8 }}>A little more detail</h3>
      <Choice label="What's prompted you to look into removal?" options={REASON_OPTIONS} value={str('reason_for_enquiry')} onChange={(v) => set('reason_for_enquiry', v)} />
      <SelectField label="What's your timeframe?" name="timeframe" required options={TIMEFRAME_OPTIONS} value={str('timeframe')} onChange={(v) => set('timeframe', v)} />
      <SelectField label="How would you prefer we contact you?" name="preferred_contact_method" required options={CONTACT_METHOD_OPTIONS} value={str('preferred_contact_method')} onChange={(v) => set('preferred_contact_method', v)} />

      <h3 style={{ fontSize: '1.05rem', margin: '24px 0 12px' }}>Optional &mdash; if you know it</h3>
      <SelectField
        label="Is the foam throughout the loft, or only in certain areas?"
        name="foam_location"
        options={['Throughout the whole loft', 'Only certain areas', 'Not sure']}
        value={str('foam_location')}
        onChange={(v) => set('foam_location', v)}
      />
      <SelectField
        label="Is it open-cell or closed-cell foam, if known?"
        name="foam_type"
        options={['Open-cell', 'Closed-cell', 'Not sure']}
        value={str('foam_type')}
        onChange={(v) => set('foam_type', v)}
      />
      <SelectField
        label="Has the foam already been inspected or surveyed?"
        name="previous_inspection"
        options={['Yes, a survey has been done', 'No', 'Not sure']}
        value={str('previous_inspection')}
        onChange={(v) => set('previous_inspection', v)}
      />
      <TextField
        label="Best times for an appointment (optional)"
        name="appointment_availability"
        value={str('appointment_availability')}
        onChange={(v) => set('appointment_availability', v)}
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
        label={HOMEOWNER_CONSENT_CONFIG.spray_foam_removal.shareBuyerLabel}
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
        {submitting ? 'Submitting…' : 'Finish my enquiry'}
      </button>
    </form>
  );
}

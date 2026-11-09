'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiPath } from '../../../lib/basePath';
import { HOMEOWNER_CONSENT_CONFIG } from '../../../lib/industries';
import { estimateRemovalCost, isPostcodeInServiceArea, GENERIC_INDUSTRY_ESTIMATE, type Bedrooms } from '../../../lib/sprayFoamEstimate';

type Answers = Record<string, string | boolean | undefined>;

// Calculator question steps, then the lead-capture step -- the estimate/results only come back
// AFTER details are submitted (Fabien's explicit call: capture first, deliver the assessment as
// what they get in return, rather than showing it free before asking for anything). Kept as a
// plain index rather than named states so "Back" is just step - 1 -- no separate per-step history
// stack needed, since every step before CAPTURE is answer-only (nothing async, nothing to undo).
const STEP = {
  POSTCODE: 0,
  PROPERTY_TYPE: 1,
  BEDROOMS: 2,
  ROOF_LOFT: 3,
  REASON: 4,
  CAPTURE: 5,
} as const;
const TOTAL_QUESTION_STEPS = 6; // POSTCODE..CAPTURE, for the progress indicator

function ProgressBar({ step }: { step: number }) {
  const pct = Math.round(((step + 1) / TOTAL_QUESTION_STEPS) * 100);
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ height: 6, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--bronze)', transition: 'width 200ms ease' }} />
      </div>
      <p style={{ fontSize: '0.78rem', color: 'var(--slate)', marginTop: 6 }}>
        Step {step + 1} of {TOTAL_QUESTION_STEPS}
      </p>
    </div>
  );
}

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

const BEDROOM_OPTIONS = ['1-2 bedrooms', '3 bedrooms', '4 bedrooms', '5+ bedrooms', 'Not sure'];
function toBedroomsKey(label: string): Bedrooms | undefined {
  if (label === '1-2 bedrooms') return '1-2';
  if (label === '3 bedrooms') return '3';
  if (label === '4 bedrooms') return '4';
  if (label === '5+ bedrooms') return '5+';
  if (label === 'Not sure') return 'not_sure';
  return undefined;
}

export default function SprayFoamCalculator() {
  const [step, setStep] = useState<number>(STEP.POSTCODE);
  const [a, setA] = useState<Answers>({});
  const [botField, setBotField] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ reference: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = (key: string, value: Answers[string]) => setA((prev) => ({ ...prev, [key]: value }));
  const str = (key: string) => (typeof a[key] === 'string' ? (a[key] as string) : '');
  const bool = (key: string) => (typeof a[key] === 'boolean' ? (a[key] as boolean) : false);

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => Math.max(STEP.POSTCODE, s - 1));

  function BackNext({ canAdvance, nextLabel = 'Next' }: { canAdvance: boolean; nextLabel?: string }) {
    return (
      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        {step > STEP.POSTCODE && (
          <button type="button" className="btn" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }} onClick={back}>
            Back
          </button>
        )}
        <button type="button" className="btn btn-bronze" disabled={!canAdvance} onClick={next}>
          {nextLabel}
        </button>
      </div>
    );
  }

  if (result) {
    const inArea = isPostcodeInServiceArea(str('postcode'));
    const estimate = estimateRemovalCost(toBedroomsKey(str('bedrooms')));
    const estimateLine = estimate.specific
      ? `Based on confirmed pricing for properties like yours, removal typically falls in the range of £${estimate.range.low}–£${estimate.range.high}.`
      : `Typical UK spray foam removal costs around £${GENERIC_INDUSTRY_ESTIMATE.perM2.low}–£${GENERIC_INDUSTRY_ESTIMATE.perM2.high} per m², with most full loft jobs costing £${GENERIC_INDUSTRY_ESTIMATE.totalJob.low.toLocaleString()}–£${GENERIC_INDUSTRY_ESTIMATE.totalJob.high.toLocaleString()} in total.`;

    return (
      <div className="form-card">
        <h2 style={{ fontSize: '1.3rem', marginBottom: 4 }}>Enquiry received</h2>
        <p style={{ marginBottom: 16 }}>
          Your reference: <strong>{result.reference}</strong>
        </p>

        <h3 style={{ fontSize: '1.05rem', marginBottom: 12 }}>Your Initial Spray Foam Removal Assessment</h3>

        <div className="disclaimer-box" style={{ marginBottom: 16 }}>
          <p style={{ margin: 0 }}>{estimateLine}</p>
          {!estimate.specific && (
            <p style={{ margin: '8px 0 0', fontSize: '0.82rem' }}>
              This is a general UK industry guide, not a quote from us or from a specific removal
              specialist &mdash; your actual price depends on your property, and we&rsquo;ll help you
              get a specific figure after a proper assessment. Source:{' '}
              {GENERIC_INDUSTRY_ESTIMATE.sources.map((s, i) => (
                <span key={s.url}>
                  {i > 0 && ', '}
                  <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--bronze)' }}>
                    {s.name}
                  </a>
                </span>
              ))}
              .
            </p>
          )}
        </div>

        <p style={{ color: 'var(--slate)' }}>
          {inArea
            ? "Good news — your postcode is within our current service area for Spray Foam Removal."
            : "Your postcode is currently outside the area we have a vetted specialist for. We'll still review your enquiry, but we can't promise an immediate match."}
        </p>

        <h3 style={{ fontSize: '0.95rem', margin: '20px 0 8px' }}>What you told us</h3>
        <ul className="dont-list">
          <li>Postcode: {str('postcode') || '—'}</li>
          <li>Property: {str('property_type') || '—'}, {str('bedrooms') || '—'}</li>
          <li>Foam: {str('foam_extent') || '—'}, {str('foam_type') || '—'}</li>
          <li>Loft size: {str('loft_size_estimate') || '—'}, access: {str('roof_access') || '—'}</li>
          <li>Reason: {str('reason_for_removal') || '—'}</li>
        </ul>

        <h3 style={{ fontSize: '0.95rem', margin: '20px 0 8px' }}>What could change the final cost</h3>
        <ul className="dont-list">
          <li>The true extent and type of foam, confirmed on survey</li>
          <li>Roof pitch, loft access and how the foam was originally applied</li>
          <li>Any additional work the survey identifies (e.g. ventilation or decking repair)</li>
        </ul>

        <p className="form-note" style={{ textAlign: 'left' }}>
          This is an initial assessment only, not a confirmed quote. A proper survey is needed before
          any firm price can be given. We only share your details with a suitable business if you
          asked us to, and only after we judge your enquiry a genuine fit. We&rsquo;ll be in touch
          using the details you provided.
        </p>
      </div>
    );
  }

  // --- Calculator question steps -------------------------------------------------------------
  if (step === STEP.POSTCODE) {
    return (
      <div className="form-card">
        <ProgressBar step={step} />
        <h3 style={{ fontSize: '1.05rem', marginBottom: 12 }}>Where&rsquo;s the property?</h3>
        <TextField label="UK postcode" name="postcode" required value={str('postcode')} onChange={(v) => set('postcode', v)} />
        <TextField
          label="House number or property name (optional)"
          name="house_number_or_name"
          value={str('house_number_or_name')}
          onChange={(v) => set('house_number_or_name', v)}
        />
        <BackNext canAdvance={str('postcode').trim().length > 0} />
      </div>
    );
  }

  if (step === STEP.PROPERTY_TYPE) {
    return (
      <div className="form-card">
        <ProgressBar step={step} />
        <h3 style={{ fontSize: '1.05rem', marginBottom: 12 }}>What type of property is it?</h3>
        <Choice
          label=""
          options={['Detached house', 'Semi-detached house', 'Terraced house', 'Bungalow', 'Other']}
          value={str('property_type')}
          onChange={(v) => set('property_type', v)}
        />
        <BackNext canAdvance={str('property_type').length > 0} />
      </div>
    );
  }

  if (step === STEP.BEDROOMS) {
    return (
      <div className="form-card">
        <ProgressBar step={step} />
        <h3 style={{ fontSize: '1.05rem', marginBottom: 12 }}>Roughly how big is the property?</h3>
        <Choice label="" options={BEDROOM_OPTIONS} value={str('bedrooms')} onChange={(v) => set('bedrooms', v)} />
        <BackNext canAdvance={str('bedrooms').length > 0} />
      </div>
    );
  }

  if (step === STEP.ROOF_LOFT) {
    return (
      <div className="form-card">
        <ProgressBar step={step} />
        <h3 style={{ fontSize: '1.05rem', marginBottom: 12 }}>Tell us about the spray foam.</h3>
        <SelectField
          label="Is the foam throughout the loft, or only in certain areas?"
          name="foam_extent"
          options={['Throughout the whole loft', 'Only certain areas', 'Not sure']}
          value={str('foam_extent')}
          onChange={(v) => set('foam_extent', v)}
        />
        <SelectField
          label="Is it open-cell or closed-cell foam, if known?"
          name="foam_type"
          options={['Open-cell', 'Closed-cell', 'Not sure']}
          value={str('foam_type')}
          onChange={(v) => set('foam_type', v)}
        />
        <SelectField
          label="Roughly how large is the loft or roof area?"
          name="loft_size_estimate"
          options={['Small (under 20m²)', 'Medium (20–40m²)', 'Large (40m²+)', 'Not sure']}
          value={str('loft_size_estimate')}
          onChange={(v) => set('loft_size_estimate', v)}
        />
        <SelectField
          label="Is the loft easily accessible?"
          name="roof_access"
          options={['Easy loft hatch access', 'Difficult or restricted access', 'Not sure']}
          value={str('roof_access')}
          onChange={(v) => set('roof_access', v)}
        />
        <p className="form-note" style={{ textAlign: 'left', marginTop: 4 }}>
          &ldquo;Not sure&rdquo; is a completely fine answer to any of these &mdash; a proper survey confirms
          the detail later.
        </p>
        <BackNext canAdvance={true} />
      </div>
    );
  }

  if (step === STEP.REASON) {
    return (
      <div className="form-card">
        <ProgressBar step={step} />
        <h3 style={{ fontSize: '1.05rem', marginBottom: 12 }}>What&rsquo;s prompted you to look into removal?</h3>
        <Choice
          label=""
          options={[
            'Mortgage or remortgage concerns',
            'Selling the property',
            'Surveyor has raised an issue',
            'Damp or ventilation concerns',
            'General maintenance',
            'Other',
          ]}
          value={str('reason_for_removal')}
          onChange={(v) => set('reason_for_removal', v)}
        />
        <BackNext canAdvance={str('reason_for_removal').length > 0} nextLabel="Continue" />
      </div>
    );
  }

  // --- Lead capture ------------------------------------------------------------------------
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

    // Computed here (not stored via set() first) so the POST body reflects it immediately --
    // set() only takes effect on the next render, and there is no next render before this fetch.
    const inArea = isPostcodeInServiceArea(str('postcode'));
    const estimate = estimateRemovalCost(toBedroomsKey(str('bedrooms')));
    const estimateLine = estimate.specific
      ? `Based on confirmed pricing for properties like yours, removal typically falls in the range of £${estimate.range.low}–£${estimate.range.high}.`
      : `Typical UK spray foam removal costs around £${GENERIC_INDUSTRY_ESTIMATE.perM2.low}–£${GENERIC_INDUSTRY_ESTIMATE.perM2.high} per m², with most full loft jobs costing £${GENERIC_INDUSTRY_ESTIMATE.totalJob.low.toLocaleString()}–£${GENERIC_INDUSTRY_ESTIMATE.totalJob.high.toLocaleString()} in total.`;

    setSubmitting(true);
    try {
      const res = await fetch(apiPath('/api/homeowner-enquiries'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...a,
          industry_slug: 'spray_foam_removal',
          bot_field: botField,
          calculator_in_area: inArea,
          calculator_estimate_available: estimate.specific,
          calculator_estimate_shown: estimateLine,
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

      <ProgressBar step={step} />
      <h3 style={{ fontSize: '1.05rem', marginBottom: 8 }}>Get your estimate</h3>
      <p className="form-note" style={{ textAlign: 'left', marginBottom: 16 }}>
        Add your details below and we&rsquo;ll show you your initial assessment straight away. Only
        with your consent below will we pass your enquiry to a vetted removal specialist.
      </p>

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
      <SelectField
        label="Property ownership status"
        name="ownership_status"
        required
        options={['I own this property', 'I rent this property', 'Other']}
        value={str('ownership_status')}
        onChange={(v) => set('ownership_status', v)}
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

      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button type="button" className="btn" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }} onClick={back}>
          Back
        </button>
        <button type="submit" className="btn btn-bronze" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit enquiry'}
        </button>
      </div>
    </form>
  );
}

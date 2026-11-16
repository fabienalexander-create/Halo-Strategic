'use client';

import { useState } from 'react';
import { apiPath } from '../../../../lib/basePath';

const INDUSTRIES = [
  { slug: 'spray_foam_removal', label: 'Spray Foam Removal' },
  { slug: 'solar_battery', label: 'Solar & Battery' },
  { slug: 'roofing', label: 'Roofing' },
];

export default function NewBuyerForm() {
  const [form, setForm] = useState({
    industry_slug: 'spray_foam_removal', company_name: '', contact_name: '', contact_email: '',
    telephone: '', coverage_type: 'national', notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ application_reference: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(apiPath('/api/admin/buyers/create'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, counties_covered: ['Nationwide'] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create buyer.');
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="form-card">
        <p>Created as <strong>{result.application_reference}</strong>, status PENDING_REVIEW.</p>
        <p>
          <a className="btn btn-bronze" href={`/leads-exchange/admin/applications/${result.application_reference}`}>
            Open in Buyer Applications
          </a>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="form-card">
      {error && <div className="disclaimer-box" style={{ marginBottom: 16 }}>{error}</div>}
      <div className="form-row">
        <label htmlFor="industry">Industry</label>
        <select id="industry" value={form.industry_slug} onChange={(e) => setForm({ ...form, industry_slug: e.target.value })}>
          {INDUSTRIES.map((i) => <option key={i.slug} value={i.slug}>{i.label}</option>)}
        </select>
      </div>
      <div className="form-row">
        <label htmlFor="company_name">Company name</label>
        <input id="company_name" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="e.g. Russell Griffiths (business name pending)" required />
      </div>
      <div className="form-row">
        <label htmlFor="contact_name">Contact name</label>
        <input id="contact_name" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} required />
      </div>
      <div className="form-row">
        <label htmlFor="contact_email">Contact email</label>
        <input id="contact_email" type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} required />
      </div>
      <div className="form-row">
        <label htmlFor="telephone">Telephone</label>
        <input id="telephone" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} required />
      </div>
      <div className="form-row">
        <label htmlFor="coverage_type">Coverage</label>
        <select id="coverage_type" value={form.coverage_type} onChange={(e) => setForm({ ...form, coverage_type: e.target.value })}>
          <option value="national">Nationwide</option>
          <option value="regional">Regional</option>
        </select>
      </div>
      <div className="form-row">
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="e.g. agreed verbally 2026-11-16: £65/lead, duplicates payable, nationwide spray foam" />
      </div>
      <button className="btn btn-bronze" type="submit" disabled={submitting || !form.company_name || !form.contact_name || !form.contact_email || !form.telephone}>
        Create buyer record
      </button>
    </form>
  );
}

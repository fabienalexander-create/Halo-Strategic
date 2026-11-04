'use client';

import { useState } from 'react';
import { apiPath } from '../../lib/basePath';

export default function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [botField, setBotField] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(apiPath('/api/contact'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message, bot_field: botField }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Something went wrong. Please try again.');
        setSubmitting(false);
        return;
      }
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="form-card" style={{ textAlign: 'center' }}>
        <p>Thanks — we&rsquo;ve received your message and will get back to you.</p>
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
          Don&rsquo;t fill this out if you&rsquo;re human:{' '}
          <input value={botField} onChange={(e) => setBotField(e.target.value)} />
        </label>
      </p>
      <div className="form-row">
        <label htmlFor="contact-name">Name</label>
        <input id="contact-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="form-row">
        <label htmlFor="contact-email">Email</label>
        <input id="contact-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="form-row">
        <label htmlFor="contact-message">Message</label>
        <textarea id="contact-message" required value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <button type="submit" className="btn btn-bronze btn-wide" disabled={submitting}>
        {submitting ? 'Sending…' : 'Send'}
      </button>
    </form>
  );
}

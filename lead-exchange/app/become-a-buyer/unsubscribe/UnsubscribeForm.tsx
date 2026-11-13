'use client';

import { useState } from 'react';
import { apiPath } from '../../../lib/basePath';

// Deliberately does nothing on page load / GET -- some corporate email security scanners
// "click" every link in an incoming email, including unsubscribe links. If visiting this page
// alone unsubscribed someone, that would silently and wrongly unsubscribe people who never asked
// to be. The actual unsubscribe only happens when the visitor explicitly presses one of the
// buttons below, which POSTs to the API route.
export default function UnsubscribeForm() {
  const [token] = useState(() => (typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('token') ?? '' : ''));
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [done, setDone] = useState<{ scope: string; alreadyApplied: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function unsubscribe(scope: 'intro' | 'marketing' | 'all') {
    setSubmitting(scope);
    setError(null);
    try {
      const res = await fetch(apiPath('/api/buyer-prospects/unsubscribe'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, scope }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        setSubmitting(null);
        return;
      }
      setDone({ scope, alreadyApplied: data.alreadyApplied });
    } catch {
      setError('Something went wrong — please check your connection and try again.');
      setSubmitting(null);
    }
  }

  if (!token) {
    return <p>This link is missing a required code. Please use the unsubscribe link from one of our emails.</p>;
  }

  if (done) {
    const labels: Record<string, string> = {
      intro: 'the registration email series',
      marketing: 'marketing emails',
      all: 'all emails from this series and ongoing marketing',
    };
    return (
      <div className="form-card">
        <p>
          {done.alreadyApplied
            ? `You were already unsubscribed from ${labels[done.scope]}.`
            : `You've been unsubscribed from ${labels[done.scope]}.`}
        </p>
      </div>
    );
  }

  return (
    <div className="form-card">
      {error && (
        <div style={{ background: '#F2E2DE', color: '#8C4438', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
          {error}
        </div>
      )}
      <p style={{ marginBottom: 16 }}>Choose what you&rsquo;d like to stop receiving:</p>
      <button className="btn" style={{ border: '1px solid var(--border)', marginBottom: 10, display: 'block', width: '100%' }}
        disabled={!!submitting} onClick={() => unsubscribe('intro')}>
        {submitting === 'intro' ? 'Submitting…' : 'Stop the registration email series only'}
      </button>
      <button className="btn" style={{ border: '1px solid var(--border)', marginBottom: 10, display: 'block', width: '100%' }}
        disabled={!!submitting} onClick={() => unsubscribe('marketing')}>
        {submitting === 'marketing' ? 'Submitting…' : 'Stop ongoing marketing emails only'}
      </button>
      <button className="btn btn-bronze" style={{ display: 'block', width: '100%' }}
        disabled={!!submitting} onClick={() => unsubscribe('all')}>
        {submitting === 'all' ? 'Submitting…' : 'Stop both'}
      </button>
      <p className="form-note" style={{ marginTop: 16 }}>
        Stopping the registration email series will not affect any other necessary communication
        about an application you&rsquo;ve already submitted.
      </p>
    </div>
  );
}

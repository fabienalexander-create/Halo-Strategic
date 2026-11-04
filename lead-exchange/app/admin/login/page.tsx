'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiPath } from '../../../lib/basePath';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(apiPath('/api/admin/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Login failed.');
        setSubmitting(false);
        return;
      }
      router.push('/admin');
    } catch {
      setError('Login failed — please check your connection and try again.');
      setSubmitting(false);
    }
  }

  return (
    <section>
      <div className="container" style={{ maxWidth: 420 }}>
        <div className="eyebrow">Admin</div>
        <h1 style={{ fontSize: '1.6rem', marginBottom: 20 }}>Sign in</h1>
        <form className="form-card" onSubmit={handleSubmit}>
          {error && (
            <div style={{ background: '#F2E2DE', color: '#8C4438', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
              {error}
            </div>
          )}
          <div className="form-row">
            <label htmlFor="admin-email">Email</label>
            <input id="admin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="form-row">
            <label htmlFor="admin-password">Password</label>
            <input id="admin-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-bronze btn-wide" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </section>
  );
}

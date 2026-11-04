'use client';

import { useRouter } from 'next/navigation';

export default function AdminLogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="btn btn-bronze"
      style={{ marginTop: 20 }}
      onClick={async () => {
        await fetch('/api/admin/logout', { method: 'POST' });
        router.push('/admin/login');
      }}
    >
      Sign out
    </button>
  );
}

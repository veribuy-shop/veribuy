'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard?tab=settings');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-surface-alt)]">
      <div className="text-center">
        <div className="inline-block motion-safe:animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">Redirecting to settings...</p>
      </div>
    </div>
  );
}

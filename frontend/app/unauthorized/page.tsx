import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Access denied',
  robots: { index: false },
};

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-[var(--color-border)] p-8 text-center">
        <div className="w-16 h-16 bg-[var(--color-surface-alt)] rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-8 h-8 text-[var(--color-text)]" aria-hidden="true" />
        </div>

        <h1 className="text-2xl font-bold text-[var(--color-text)] mb-3">You don&apos;t have access to this page</h1>
        <p className="text-[var(--color-text-muted)] mb-6">
          This area is restricted to VeriBuy administrators. If you think this is a mistake,
          sign in with an administrator account or contact support.
        </p>

        <Link
          href="/dashboard"
          className="inline-block w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white py-2.5 rounded-lg font-semibold transition-colors text-center"
        >
          Go to your dashboard
        </Link>

        <p className="mt-6 text-sm text-[var(--color-text-muted)]">
          Need help?{' '}
          <Link href="/contact" className="text-[var(--color-green)] font-medium hover:underline">
            Contact support
          </Link>
        </p>
      </div>
    </div>
  );
}

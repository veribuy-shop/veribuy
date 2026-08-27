'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Intentionally swallow — always redirect to /sent for anti-enumeration
    } finally {
      // Always redirect regardless of response (never confirm/deny email existence)
      router.push('/forgot-password/sent');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-[var(--color-surface-alt)]">
      <div className="bg-white rounded-xl p-8 w-full max-w-md border border-[var(--color-border)]">
        <h1 className="text-2xl font-bold mb-2 text-center">Forgot password?</h1>
        <p className="text-[var(--color-text-muted)] text-center mb-8 text-sm">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="forgot-email" className="block text-sm font-medium mb-1">
              Email
            </label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] text-sm"
              placeholder="you@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            aria-disabled={loading}
            className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
          Remember your password?{' '}
          <Link href="/login" className="text-[var(--color-green)] font-semibold hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

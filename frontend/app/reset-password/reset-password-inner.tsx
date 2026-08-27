'use client';

import { useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CircleCheck, CircleX } from 'lucide-react';

type Status = 'idle' | 'submitting' | 'success' | 'error';

export default function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const hasSubmitted = useRef(false);

  if (!token) {
    return (
      <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-xl border border-[var(--color-border)] p-8 text-center">
          <div className="w-16 h-16 bg-[var(--color-danger)]/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CircleX className="w-8 h-8 text-[var(--color-danger)]" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--color-text)] mb-3">Invalid link</h1>
          <p className="text-[var(--color-text-muted)] mb-6">
            This password reset link is missing or invalid. Please request a new one.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-8 py-3 rounded-lg font-semibold transition-colors"
          >
            Request new link
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (hasSubmitted.current) return;

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      setStatus('error');
      return;
    }

    hasSubmitted.current = true;
    setStatus('submitting');
    setErrorMessage('');

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      if (response.ok) {
        setStatus('success');
        // Redirect to login after 3 seconds
        setTimeout(() => router.push('/login'), 3000);
      } else {
        const data = await response.json();
        setErrorMessage(data.message || 'Password reset failed. The link may have expired.');
        setStatus('error');
        hasSubmitted.current = false;
      }
    } catch {
      setErrorMessage('Something went wrong. Please try again.');
      setStatus('error');
      hasSubmitted.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-[var(--color-border)] p-8 text-center">
        {status === 'success' ? (
          <>
            <div className="w-16 h-16 bg-[var(--color-green)]/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CircleCheck className="w-8 h-8 text-[var(--color-green)]" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--color-text)] mb-3">Password reset!</h1>
            <p className="text-[var(--color-text-muted)] mb-6">
              Your password has been updated. Redirecting you to sign in…
            </p>
            <Link
              href="/login"
              className="inline-block bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Sign in now
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-2 text-center">Set new password</h1>
            <p className="text-[var(--color-text-muted)] text-center mb-8 text-sm">
              Choose a strong password for your VeriBuy account.
            </p>

            <div aria-live="polite" aria-atomic="true">
              {status === 'error' && (
                <div
                  role="alert"
                  className="bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 text-[var(--color-danger)] px-4 py-3 rounded-lg mb-4 text-sm text-left"
                >
                  {errorMessage}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-left" noValidate>
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium mb-1">
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] text-sm"
                  placeholder="At least 8 characters"
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium mb-1">
                  Confirm new password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] text-sm"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={status === 'submitting'}
                aria-disabled={status === 'submitting'}
                className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'submitting' ? 'Resetting...' : 'Reset password'}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
              <Link href="/forgot-password" className="text-[var(--color-green)] font-medium hover:underline">
                Request a new link
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

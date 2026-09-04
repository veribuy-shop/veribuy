'use client';

import { useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { CircleCheck, CircleX, KeyRound, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

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
      <div className="min-h-[80vh] bg-[var(--color-surface-alt)] flex items-center justify-center px-4 py-12">
        <div className="max-w-md w-full bg-white rounded-3xl border border-[var(--color-border)] p-8 sm:p-10 text-center shadow-xl">
          <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-100">
            <CircleX className="w-8 h-8" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">Invalid or Expired Link</h1>
          <p className="text-xs sm:text-sm text-gray-500 mb-6 leading-relaxed">
            This password reset link is invalid or has expired. Please request a new link to proceed.
          </p>
          <Link
            href="/forgot-password"
            className="inline-flex items-center gap-2 bg-[var(--color-green)] hover:bg-[var(--color-green-dark)] text-white px-8 py-3.5 rounded-xl font-bold text-sm transition-all shadow-md"
          >
            <span>Request New Reset Link</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasSubmitted.current) return;

    if (newPassword.length < 8) {
      setErrorMessage('Password must be at least 8 characters.');
      setStatus('error');
      return;
    }

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
        setTimeout(() => router.push('/login'), 2500);
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
    <div className="min-h-[80vh] bg-[var(--color-surface-alt)] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full bg-white rounded-3xl border border-[var(--color-border)] p-8 sm:p-10 text-center shadow-xl">
        {status === 'success' ? (
          <>
            <div className="w-16 h-16 bg-emerald-50 text-[var(--color-green)] rounded-2xl flex items-center justify-center mx-auto mb-6 border border-emerald-100 shadow-sm">
              <CircleCheck className="w-8 h-8" aria-hidden="true" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2">Password Reset!</h1>
            <p className="text-xs sm:text-sm text-gray-500 mb-6 leading-relaxed">
              Your password has been successfully updated. Redirecting you to sign in…
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-[var(--color-green)] hover:bg-[var(--color-green-dark)] text-white px-8 py-3.5 rounded-xl font-bold text-sm transition-all shadow-md"
            >
              <span>Sign In Now</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[var(--color-green)] flex items-center justify-center mx-auto mb-4 border border-emerald-100">
              <KeyRound className="w-7 h-7" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-2">Set New Password</h1>
            <p className="text-xs sm:text-sm text-gray-500 mb-6 leading-relaxed">
              Choose a strong, secure password for your VeriBuy account.
            </p>

            {status === 'error' && (
              <div role="alert" className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 mb-4 text-left">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-left" noValidate>
              <div>
                <label htmlFor="new-password" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  New Password
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] text-sm text-gray-900 bg-white placeholder-gray-400 shadow-xs"
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  Confirm New Password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full px-4 py-3 border border-[var(--color-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] text-sm text-gray-900 bg-white placeholder-gray-400 shadow-xs"
                  placeholder="Re-enter password"
                />
              </div>

              <button
                type="submit"
                disabled={status === 'submitting'}
                aria-disabled={status === 'submitting'}
                className="w-full py-3.5 bg-[var(--color-green)] hover:bg-[var(--color-green-dark)] text-white rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {status === 'submitting' ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Resetting password...</span>
                  </>
                ) : (
                  <>
                    <span>Update Password</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-gray-100 text-center text-xs text-gray-500">
              <Link href="/forgot-password" className="text-[var(--color-green)] font-bold hover:underline">
                Request a new reset link
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

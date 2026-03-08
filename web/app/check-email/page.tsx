'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function CheckEmailPage() {
  const [resending, setResending] = useState(false);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleResend = async () => {
    setResending(true);
    setResendStatus('idle');
    setErrorMessage('');

    try {
      const response = await fetch('/api/auth/send-verification-email', {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        setResendStatus('sent');
      } else {
        const data = await response.json();
        setErrorMessage(data.message || 'Failed to resend verification email.');
        setResendStatus('error');
      }
    } catch {
      setErrorMessage('Something went wrong. Please try again.');
      setResendStatus('error');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-[var(--color-border)] p-8 text-center">
        {/* Icon */}
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg
            className="w-8 h-8 text-[var(--color-primary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-[var(--color-text)] mb-3">Check your email</h1>
        <p className="text-[var(--color-text-muted)] mb-6">
          We&apos;ve sent a verification link to your email address. Click the link to activate your
          account. The link expires in 24 hours.
        </p>

        {/* Resend section */}
        <div className="border-t border-[var(--color-border)] pt-6">
          <p className="text-sm text-[var(--color-text-muted)] mb-3">
            Didn&apos;t receive it? Check your spam folder or resend.
          </p>

          {resendStatus === 'sent' ? (
            <p
              role="status"
              aria-live="polite"
              className="text-sm text-green-600 font-medium"
            >
              Verification email resent! Please check your inbox.
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {resending ? 'Sending...' : 'Resend verification email'}
              </button>

              {resendStatus === 'error' && (
                <p
                  role="alert"
                  aria-live="assertive"
                  className="mt-3 text-sm text-red-600"
                >
                  {errorMessage}
                </p>
              )}
            </>
          )}
        </div>

        <p className="mt-6 text-sm text-[var(--color-text-muted)]">
          Already verified?{' '}
          <Link href="/login" className="text-[var(--color-primary)] font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

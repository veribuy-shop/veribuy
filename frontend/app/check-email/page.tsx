'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';

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
      <div className="max-w-md w-full bg-white rounded-xl border border-[var(--color-border)] p-8 text-center">
        {/* Icon */}
        <div className="w-16 h-16 bg-[var(--color-surface-alt)] rounded-full flex items-center justify-center mx-auto mb-6">
          <Mail className="w-8 h-8 text-[var(--color-text)]" aria-hidden="true" />
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
              className="text-sm text-[var(--color-green)] font-medium"
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
                  className="mt-3 text-sm text-[var(--color-danger)]"
                >
                  {errorMessage}
                </p>
              )}
            </>
          )}
        </div>

        <p className="mt-6 text-sm text-[var(--color-text-muted)]">
          Already verified?{' '}
          <Link href="/login" className="text-[var(--color-green)] font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

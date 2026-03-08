'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type Status = 'verifying' | 'success' | 'error';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<Status>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const hasCalled = useRef(false);

  useEffect(() => {
    // Guard against React StrictMode double-invoke
    if (hasCalled.current) return;
    hasCalled.current = true;

    if (!token) {
      setErrorMessage('Missing verification token. Please use the link from your email.');
      setStatus('error');
      return;
    }

    const verify = async () => {
      try {
        const response = await fetch(
          `/api/auth/verify-email?token=${encodeURIComponent(token)}`,
          { method: 'GET' }
        );

        if (response.ok) {
          setStatus('success');
          // Redirect to login after 3 seconds
          setTimeout(() => router.push('/login'), 3000);
        } else {
          const data = await response.json();
          setErrorMessage(data.message || 'Verification failed. The link may have expired.');
          setStatus('error');
        }
      } catch {
        setErrorMessage('Something went wrong. Please try again.');
        setStatus('error');
      }
    };

    verify();
  }, [token, router]);

  return (
    <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-[var(--color-border)] p-8 text-center">
        {status === 'verifying' && (
          <>
            <div className="w-12 h-12 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-6" role="status" aria-label="Verifying email" />
            <h1 className="text-2xl font-bold text-[var(--color-text)] mb-2">Verifying your email</h1>
            <p className="text-[var(--color-text-muted)]">Please wait a moment…</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[var(--color-text)] mb-3">Email verified!</h1>
            <p className="text-[var(--color-text-muted)] mb-6">
              Your account is now active. Redirecting you to sign in…
            </p>
            <Link
              href="/login"
              className="inline-block bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Sign in now
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[var(--color-text)] mb-3">Verification failed</h1>
            <p className="text-[var(--color-text-muted)] mb-6">{errorMessage}</p>
            <Link
              href="/check-email"
              className="inline-block bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Resend verification email
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

import Link from 'next/link';
import { Mail } from 'lucide-react';

export default function ForgotPasswordSentPage() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl border border-[var(--color-border)] p-8 text-center">
        {/* Icon */}
        <div className="w-16 h-16 bg-[var(--color-surface-alt)] rounded-full flex items-center justify-center mx-auto mb-6">
          <Mail className="w-8 h-8 text-[var(--color-text)]" aria-hidden="true" />
        </div>

        <h1 className="text-2xl font-bold text-[var(--color-text)] mb-3">Check your email</h1>
        <p className="text-[var(--color-text-muted)] mb-6">
          If that email address is registered, you&apos;ll receive a password reset link shortly.
          The link expires in 1 hour.
        </p>

        <div className="border-t border-[var(--color-border)] pt-6">
          <p className="text-sm text-[var(--color-text-muted)] mb-4">
            Didn&apos;t receive it? Check your spam folder, or try again with the correct email
            address.
          </p>
          <Link
            href="/forgot-password"
            className="inline-block w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white py-2.5 rounded-lg font-semibold transition-colors text-center"
          >
            Try again
          </Link>
        </div>

        <p className="mt-6 text-sm text-[var(--color-text-muted)]">
          Remember your password?{' '}
          <Link href="/login" className="text-[var(--color-green)] font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

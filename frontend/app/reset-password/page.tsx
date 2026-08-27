import { Suspense } from 'react';
import ResetPasswordInner from './reset-password-inner';

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--color-surface)] flex items-center justify-center px-4">
          <div className="max-w-md w-full bg-white rounded-xl border border-[var(--color-border)] p-8 text-center">
            <div
              className="w-12 h-12 border-4 border-[var(--color-green)] border-t-transparent rounded-full animate-spin mx-auto mb-6"
              role="status"
              aria-label="Loading"
            />
            <h1 className="text-2xl font-bold text-[var(--color-text)] mb-2">Loading</h1>
            <p className="text-[var(--color-text-muted)]">Please wait a moment…</p>
          </div>
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Check,
  BadgeCheck,
  RotateCcw,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const WHY_JOIN = [
  { icon: BadgeCheck, label: 'Verified Electronics' },
  { icon: Lock,       label: 'Secure Transactions' },
  { icon: ShieldCheck,label: '50k+ Trusted Buyers' },
  { icon: RotateCcw,  label: 'Hassle-Free Returns' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RegisterPage() {
  const { register } = useAuth();

  const [step, setStep]               = useState<1 | 2>(1);
  const [name, setName]               = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError]             = useState('');
  const [loading, setLoading]         = useState(false);

  const nameValid  = name.trim().length >= 2;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordHasLength    = password.length >= 8;
  const passwordHasUpper     = /[A-Z]/.test(password);
  const passwordHasLower     = /[a-z]/.test(password);
  const passwordHasDigit     = /\d/.test(password);
  const passwordHasSpecial   = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  const passwordValid = passwordHasLength && passwordHasUpper && passwordHasLower && passwordHasDigit && passwordHasSpecial;
  const canSubmit  = nameValid && emailValid && passwordValid && agreedToTerms;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      setError('Please fill in all fields and agree to the terms.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register(name, email, password);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 min-h-0 bg-white">

      {/* -- Left: Form -- */}
      <div className="flex-1 flex flex-col justify-center px-8 py-12 max-w-xl mx-auto w-full">

        {/* Step progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs font-medium mb-2">
            <span className={cn(step === 1 ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]/60')}>
              Step 1 of 2: <span className="font-bold">Create Account</span>
            </span>
            <span className={cn(step === 2 ? 'text-[var(--color-text)] font-bold' : 'text-[var(--color-text-muted)]/60')}>
              Step 2: Preferences
            </span>
          </div>
          <div className="relative h-1.5 bg-[var(--color-border)] rounded-full">
            <div
              className="absolute inset-y-0 left-0 bg-[var(--color-primary)] rounded-full transition-all"
              style={{ width: step === 1 ? '50%' : '100%' }}
            />
            {/* Step 1 circle marker */}
            <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[var(--color-primary)] border-2 border-white flex items-center justify-center shadow-sm">
              <Check className="w-2.5 h-2.5 text-white" aria-hidden="true" />
            </div>
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-bold text-[var(--color-text)] mb-6 leading-tight">
          {step === 1 ? 'Create your VeriBuy\nAccount.' : 'Set your Preferences.'}
        </h1>

        {/* Error */}
        <div aria-live="polite" aria-atomic="true">
          {error && (
            <div role="alert" className="flex items-center gap-2 bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 text-[var(--color-danger)] px-4 py-3 rounded-xl mb-5 text-sm">
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--color-danger)]" aria-hidden="true" />
              {error}
            </div>
          )}
        </div>

        {/* -- Step 1: All fields -- */}
        {step === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); setError(''); if (nameValid && emailValid && passwordValid) { setStep(2); } else { setError('Please fill in all fields correctly.'); } }} className="space-y-4" noValidate>

            {/* Full Name */}
            <div>
              <label htmlFor="reg-name" className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                Full Name
              </label>
              <input
                id="reg-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder="e.g., Jane Doe"
                className={cn(
                  'w-full px-4 py-3 border border-[var(--color-border)] rounded-lg text-sm',
                  'text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/60',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] focus:border-[var(--color-green)] transition-colors',
                )}
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="reg-email" className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                Email Address
              </label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="jane.doe@email.com"
                className={cn(
                  'w-full px-4 py-3 border border-[var(--color-border)] rounded-lg text-sm',
                  'text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/60',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] focus:border-[var(--color-green)] transition-colors',
                )}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="reg-password" className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className={cn(
                    'w-full px-4 py-3 pr-20 border border-[var(--color-border)] rounded-lg text-sm',
                    'text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/60',
                    'focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] focus:border-[var(--color-green)] transition-colors',
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {password.length > 0 && (
                <div className="mt-2 space-y-1">
                  {[
                    { ok: passwordHasLength,  label: 'At least 8 characters' },
                    { ok: passwordHasUpper,   label: 'One uppercase letter' },
                    { ok: passwordHasLower,   label: 'One lowercase letter' },
                    { ok: passwordHasDigit,   label: 'One number' },
                    { ok: passwordHasSpecial, label: 'One special character' },
                  ].map(({ ok, label }) => (
                    <div key={label} className="flex items-center gap-1.5 text-xs">
                      {ok ? (
                        <Check className="w-3 h-3 text-[var(--color-green)]" aria-hidden="true" />
                      ) : (
                        <span className="w-3 h-3 rounded-full border border-[var(--color-border)] inline-block" aria-hidden="true" />
                      )}
                      <span className={ok ? 'text-[var(--color-green)]' : 'text-[var(--color-text-muted)]'}>{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Terms */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="w-4 h-4 rounded border-[var(--color-border)] text-[var(--color-green)] focus:ring-[var(--color-green)]"
              />
              <span className="text-xs text-[var(--color-text-muted)]">
                I agree to the{' '}
                <Link href="/terms" className="text-[var(--color-green)] hover:underline">Terms of Service</Link>
                {' '}and{' '}
                <Link href="/privacy" className="text-[var(--color-green)] hover:underline">Privacy Policy</Link>.
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              className="w-full py-3.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white rounded-lg font-semibold text-sm transition-colors shadow-sm mt-2"
            >
              Create Account
            </button>
          </form>
        )}

        {/* -- Step 2: Preferences -- */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <p className="text-sm text-[var(--color-text-muted)]">Almost there! Create your account to continue.</p>

            {/* Summary pill */}
            <div className="flex items-center gap-3 bg-[var(--color-surface-alt)] rounded-xl px-4 py-3 border border-[var(--color-border)]">
              <div
                className="w-9 h-9 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-sm font-bold shrink-0">
                {name.trim().charAt(0).toUpperCase() || '?'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--color-text)] truncate">{name}</p>
                <p className="text-xs text-[var(--color-text-muted)] truncate">{email}</p>
              </div>
            </div>

            <button type="button" onClick={() => { setStep(1); setError(''); }}
              className="text-sm text-[var(--color-green)] hover:underline">
              &larr; Back
            </button>

            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="w-full py-3.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-sm transition-colors shadow-sm"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Creating account...
                </span>
              ) : 'Finish & Create Account'}
            </button>
          </form>
        )}

        {/* Footer */}
        <p className="mt-6 text-sm text-[var(--color-text-muted)] text-center">
          Already have an account?{' '}
          <Link href="/login" className="text-[var(--color-green)] font-semibold hover:underline">Log In</Link>.
        </p>
      </div>

      {/* -- Right: Why Join VeriBuy -- */}
      <div className="hidden lg:flex lg:w-[42%] bg-[var(--color-surface-alt)] flex-col justify-center px-12 py-12">
        <h2 className="text-3xl font-bold text-[var(--color-text)] mb-8 leading-tight">
          Why Join<br />VeriBuy?
        </h2>

        {/* Benefits */}
        <div className="space-y-5 mb-10">
          {WHY_JOIN.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-full border-2 border-[var(--color-border)] bg-white flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-[var(--color-text)]" aria-hidden="true" />
              </div>
              <span className="text-base font-medium text-[var(--color-text)]">{label}</span>
            </div>
          ))}
        </div>

        {/* Testimonial card */}
        <div className="bg-white rounded-2xl p-5 border border-[var(--color-border)]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-300 to-amber-300 shrink-0 overflow-hidden flex items-center justify-center text-white font-bold text-sm">
              S
            </div>
            <div>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-2">
                &ldquo;I found the perfect laptop in mint condition. The verification process gave me complete peace of mind.&rdquo;
              </p>
              <p className="text-xs font-semibold text-[var(--color-text)]">- Sarah K.</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

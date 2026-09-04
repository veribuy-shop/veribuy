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
  Sparkles,
  ArrowRight,
  AlertCircle,
  Coins,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const WHY_JOIN = [
  { icon: ShieldCheck, label: '100% Trust Lens™ Verified Hardware' },
  { icon: Lock,        label: 'Stripe Escrow Payment Protection' },
  { icon: Coins,       label: '0% Seller Commission (Keep 100%)' },
  { icon: RotateCcw,  label: '7-Day Money-Back Guarantee' },
];

export default function RegisterPage() {
  const { register } = useAuth();

  const [step, setStep]                   = useState<1 | 2>(1);
  const [name, setName]                   = useState('');
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError]                 = useState('');
  const [loading, setLoading]             = useState(false);

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
      setError('Please fill in all required fields and accept the marketplace terms.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register(name, email, password);
    } catch (err: any) {
      setError(err.message || 'Failed to create account. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 min-h-[calc(100vh-4rem)] bg-white">
      {/* -- Left: Form -- */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 py-12 max-w-xl mx-auto w-full">
        {/* Step Progress Bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-xs font-bold mb-2">
            <span className={cn(step === 1 ? 'text-[var(--color-green)]' : 'text-gray-400')}>
              Step 1: Account Details
            </span>
            <span className={cn(step === 2 ? 'text-[var(--color-green)]' : 'text-gray-400')}>
              Step 2: Confirmation
            </span>
          </div>
          <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-[var(--color-green)] rounded-full transition-all duration-300"
              style={{ width: step === 1 ? '50%' : '100%' }}
            />
          </div>
        </div>

        {/* Heading */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[var(--color-green)] border border-emerald-200 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Join VeriBuy Marketplace</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
            {step === 1 ? 'Create Your Account' : 'Confirm & Complete'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {step === 1
              ? 'Buy verified electronics with escrow or sell with 0% commission.'
              : 'Review your details and finish setting up your account.'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div role="alert" className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* -- Step 1: Form Fields -- */}
        {step === 1 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              if (nameValid && emailValid && passwordValid && agreedToTerms) {
                setStep(2);
              } else if (!agreedToTerms) {
                setError('Please agree to the Terms of Service and Privacy Policy to proceed.');
              } else {
                setError('Please complete all fields according to the criteria.');
              }
            }}
            className="space-y-4"
            noValidate
          >
            {/* Full Name */}
            <div>
              <label htmlFor="reg-name" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Full Name
              </label>
              <input
                id="reg-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                placeholder="e.g. Jane Doe"
                className={cn(
                  'w-full px-4 py-3 border border-[var(--color-border)] rounded-xl text-sm bg-white',
                  'text-gray-900 placeholder:text-gray-400',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent transition-all shadow-xs',
                )}
              />
            </div>

            {/* Email Address */}
            <div>
              <label htmlFor="reg-email" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Email Address
              </label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="jane.doe@example.com"
                className={cn(
                  'w-full px-4 py-3 border border-[var(--color-border)] rounded-xl text-sm bg-white',
                  'text-gray-900 placeholder:text-gray-400',
                  'focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent transition-all shadow-xs',
                )}
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="reg-password" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
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
                    'w-full px-4 py-3 pr-20 border border-[var(--color-border)] rounded-xl text-sm bg-white',
                    'text-gray-900 placeholder:text-gray-400',
                    'focus:outline-none focus:ring-2 focus:ring-[var(--color-green)] focus:border-transparent transition-all shadow-xs',
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 transition-colors font-medium"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span>{showPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>

              {/* Dynamic Password Validation Requirements */}
              {password.length > 0 && (
                <div className="mt-2.5 p-3 rounded-xl bg-gray-50 border border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                  {[
                    { ok: passwordHasLength,  label: '8+ characters' },
                    { ok: passwordHasUpper,   label: 'One uppercase letter' },
                    { ok: passwordHasLower,   label: 'One lowercase letter' },
                    { ok: passwordHasDigit,   label: 'One number' },
                    { ok: passwordHasSpecial, label: 'One symbol (!@#$)' },
                  ].map(({ ok, label }) => (
                    <div key={label} className="flex items-center gap-1.5">
                      {ok ? (
                        <Check className="w-3.5 h-3.5 text-[var(--color-green)] shrink-0" />
                      ) : (
                        <span className="w-3 h-3 rounded-full border border-gray-300 inline-block shrink-0" />
                      )}
                      <span className={ok ? 'text-gray-900 font-semibold' : 'text-gray-400'}>{label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Terms Checkbox */}
            <label className="flex items-start gap-3 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[var(--color-green)] focus:ring-[var(--color-green)]"
              />
              <span className="text-xs text-gray-600 leading-relaxed">
                I agree to the{' '}
                <Link href="/terms" className="text-[var(--color-green)] font-semibold hover:underline">Terms of Service</Link>
                {' '}and{' '}
                <Link href="/privacy" className="text-[var(--color-green)] font-semibold hover:underline">Privacy Policy</Link>.
              </span>
            </label>

            {/* Next Button */}
            <button
              type="submit"
              className="w-full py-3.5 bg-[var(--color-green)] hover:bg-[var(--color-green-dark)] text-white rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg mt-2 flex items-center justify-center gap-2"
            >
              <span>Continue to Next Step</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* -- Step 2: Confirmation -- */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div className="bg-[var(--color-surface-alt)] rounded-2xl p-5 border border-[var(--color-border)]">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Account Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Name:</span>
                  <span className="font-bold text-gray-900">{name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Email:</span>
                  <span className="font-bold text-gray-900">{email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Seller Commission:</span>
                  <span className="font-bold text-[var(--color-green)]">0% Guaranteed</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setStep(1); setError(''); }}
                className="w-1/3 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-sm transition-colors"
              >
                &larr; Back
              </button>

              <button
                type="submit"
                disabled={loading || !canSubmit}
                className="w-2/3 py-3.5 bg-[var(--color-green)] hover:bg-[var(--color-green-dark)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <span>Finish &amp; Register</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <p className="mt-8 text-xs text-gray-500 text-center">
          Already have an account?{' '}
          <Link href="/login" className="text-[var(--color-green)] font-bold hover:underline">
            Sign in
          </Link>
        </p>
      </div>

      {/* -- Right: Trust Panel -- */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-950 flex-col justify-center px-12 py-12 text-white relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{ background: 'radial-gradient(circle at 70% 30%, #10B981 0%, transparent 60%)' }}
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-md">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mb-6">
            <ShieldCheck className="w-6 h-6 text-emerald-300" />
          </div>

          <h2 className="text-3xl font-black text-white mb-6 leading-tight tracking-tight">
            Why Join the VeriBuy Marketplace?
          </h2>

          <div className="space-y-4 mb-10">
            {WHY_JOIN.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-white/10 text-emerald-300 flex items-center justify-center shrink-0 border border-white/10">
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </div>
                <span className="text-xs font-semibold text-emerald-100">{label}</span>
              </div>
            ))}
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
            <p className="text-xs text-emerald-100/90 leading-relaxed italic mb-3">
              &ldquo;I sold my iPhone 14 Pro Max in 2 days. The IMEI check made the listing standout, and I kept 100% of my £750 sale price.&rdquo;
            </p>
            <p className="text-[11px] font-bold text-emerald-300">&mdash; David M., London</p>
          </div>
        </div>
      </div>
    </div>
  );
}

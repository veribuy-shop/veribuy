'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import {
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  BadgeCheck,
  Lock,
  RotateCcw,
} from 'lucide-react';

const WHY_SIGNIN = [
  { icon: BadgeCheck, label: 'Verified Electronics' },
  { icon: Lock,       label: 'Secure Transactions' },
  { icon: ShieldCheck,label: '50k+ Trusted Buyers' },
  { icon: RotateCcw,  label: 'Hassle-Free Returns' },
];

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || undefined;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password, redirectTo);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

   return (
    <div className="flex flex-1 min-h-0 bg-white">

      {/* -- Left: Form -- */}
      <div className="flex-1 flex flex-col justify-center px-8 py-12 max-w-xl mx-auto w-full">

        {/* Heading */}
        <h1 className="text-3xl font-bold text-[var(--color-text)] mb-2 leading-tight">
          Welcome back.
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-8">
          Sign in to your account to continue
        </p>

        {/* Error */}
        <div aria-live="polite" aria-atomic="true">
          {error && (
            <div role="alert" className="flex items-center gap-2 bg-[var(--color-danger)]/10 border border-[var(--color-danger)]/30 text-[var(--color-danger)] px-4 py-3 rounded-xl mb-5 text-sm">
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--color-danger)]" aria-hidden="true" />
              {error}
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>

          {/* Email */}
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-[var(--color-text)] mb-1.5">
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
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
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="login-password" className="text-sm font-medium text-[var(--color-text)]">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs text-[var(--color-green)] hover:text-[var(--color-green-dark)]">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
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
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-sm transition-colors shadow-sm mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Signing in...
              </span>
            ) : 'Sign In'}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-sm text-[var(--color-text-muted)] text-center">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-[var(--color-green)] font-semibold hover:underline">
            Sign Up
          </Link>.
        </p>
      </div>

      {/* -- Right: Trust panel -- */}
      <div className="hidden lg:flex lg:w-[42%] bg-[var(--color-surface-alt)] flex-col justify-center px-12 py-12">
        <h2 className="text-3xl font-bold text-[var(--color-text)] mb-8 leading-tight">
          Why Shop<br />with VeriBuy?
        </h2>

        {/* Benefits */}
        <div className="space-y-5 mb-10">
          {WHY_SIGNIN.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-full border-2 border-[var(--color-border)] bg-white flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-[var(--color-text)]" aria-hidden="true" />
              </div>
              <span className="text-base font-medium text-[var(--color-text)]">{label}</span>
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div className="bg-white rounded-2xl p-5 border border-[var(--color-border)]">
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { value: '50K+', label: 'Devices Verified' },
              { value: '99.4%', label: 'Satisfaction' },
              { value: '0%', label: 'Fraud Rate' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-xl font-bold text-[var(--color-primary)]">{stat.value}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}

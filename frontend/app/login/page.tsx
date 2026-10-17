'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/brand-logo';
import {
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  BadgeCheck,
  Lock,
  RotateCcw,
  Sparkles,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

const WHY_SIGNIN = [
  { icon: ShieldCheck, label: '100% Trust Lens™ Verified Hardware' },
  { icon: Lock,        label: 'Stripe Escrow Payment Protection' },
  { icon: RotateCcw,  label: '48-Hour Money-Back Return Guarantee' },
  { icon: BadgeCheck,  label: '0% Seller Commission Payouts' },
];

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

function AppleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 170 170" fill="currentColor">
      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.69-7.85-12.01-14.42-6.1-9.35-10.8-19.74-14.09-31.18-3.29-11.43-4.94-22.38-4.94-32.84 0-14.28 3.59-25.99 10.77-35.13 7.18-9.14 16.29-13.82 27.32-14.04 4.58 0 9.87 1.25 15.87 3.76 6 2.5 9.98 3.76 11.95 3.76 1.77 0 5.86-1.29 12.28-3.87 6.42-2.58 11.75-3.72 15.99-3.41 12.01.62 21.6 4.79 28.77 12.51-10.72 6.53-15.97 15.65-15.75 27.36.21 9.38 3.82 17.18 10.83 23.41 4.14 3.7 8.93 6.33 14.38 7.89-2.22 6.75-4.8 13.23-7.75 19.46zM119.22 33.15c0-6.73 2.45-13.13 7.35-19.2 4.9-6.07 10.9-10.02 18-11.85.22 1.4.33 2.7.33 3.9 0 6.64-2.57 13.08-7.71 19.32-5.14 6.24-11.18 10.15-18.12 11.73-.24-1.3-.35-2.6-.35-3.9z" />
    </svg>
  );
}

function GoogleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

function LoginContent() {
  const { login, socialLogin } = useAuth();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || undefined;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'GOOGLE' | 'APPLE' | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password, redirectTo);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const [socialModalProvider, setSocialModalProvider] = useState<'GOOGLE' | 'APPLE' | null>(null);
  const [socialModalEmail, setSocialModalEmail] = useState('');

  const triggerSocialLogin = async (provider: 'GOOGLE' | 'APPLE', targetEmail: string) => {
    setError('');
    setSocialLoading(provider);
    try {
      await socialLogin(provider, { email: targetEmail.trim(), action: 'login' }, redirectTo);
      setSocialModalProvider(null);
    } catch (err: any) {
      setError(err.message || `${provider} sign in failed. Please try again.`);
    } finally {
      setSocialLoading(null);
    }
  };

  const handleSocialAuth = async (provider: 'GOOGLE' | 'APPLE') => {
    if (email.trim()) {
      await triggerSocialLogin(provider, email.trim());
    } else {
      setSocialModalEmail('');
      setSocialModalProvider(provider);
    }
  };

  return (
    <div className="flex flex-1 min-h-[calc(100vh-4rem)] bg-white">
      {/* -- Left: Form -- */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 py-12 max-w-xl mx-auto w-full">
        <div className="mb-6">
          <Link href="/" aria-label="Back to home" className="inline-block mb-4">
            <BrandLogo priority className="h-14 sm:h-16 w-auto" />
          </Link>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[var(--color-green)] border border-emerald-200 text-xs font-bold uppercase tracking-wider mb-3">
            <Sparkles className="w-3.5 h-3.5 text-[var(--color-green)]" />
            <span>Secure Member Sign In</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
            Welcome Back
          </h1>
          <p className="text-sm text-gray-500 mt-1.5">
            Sign in to access your verified listings, active orders, and escrow balance.
          </p>
        </div>

        {/* Error Notification */}
        {error && (
          <div role="alert" className="flex items-center justify-between gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" aria-hidden="true" />
              <span>{error}</span>
            </div>
            {error.toLowerCase().includes('sign up first') && (
              <Link href="/register" className="underline font-bold text-red-900 shrink-0 hover:text-black">
                Create account →
              </Link>
            )}
            {error.toLowerCase().includes('verify your email') && (
              <Link href="/check-email" className="underline font-bold text-red-900 shrink-0 hover:text-black">
                Verify email →
              </Link>
            )}
          </div>
        )}

        {/* ── Social Login Buttons (Apple & Google) ── */}
        <div className="space-y-2.5 mb-5">
          <button
            type="button"
            onClick={() => handleSocialAuth('APPLE')}
            disabled={loading || Boolean(socialLoading)}
            className="w-full py-3 px-4 bg-black text-white hover:bg-gray-900 rounded-xl font-bold text-xs flex items-center justify-between transition-all shadow-xs disabled:opacity-50"
          >
            <div className="flex items-center gap-2.5">
              <AppleIcon className="w-4 h-4 fill-white" />
              <span>Continue with Apple</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/15 text-white">
              {socialLoading === 'APPLE' ? 'Signing in...' : '⚡ Instant'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSocialAuth('GOOGLE')}
            disabled={loading || Boolean(socialLoading)}
            className="w-full py-3 px-4 bg-white border border-gray-200 hover:bg-slate-50 text-gray-800 rounded-xl font-bold text-xs flex items-center justify-between transition-all shadow-xs disabled:opacity-50"
          >
            <div className="flex items-center gap-2.5">
              <GoogleIcon className="w-4 h-4" />
              <span>Continue with Google</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
              {socialLoading === 'GOOGLE' ? 'Signing in...' : '🔒 Passkey'}
            </span>
          </button>
        </div>

        {/* ── Crisp Divider ── */}
        <div className="relative flex items-center justify-center my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <span className="relative bg-white px-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest">
            or continue with email
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Email */}
          <div>
            <label htmlFor="login-email" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
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
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="login-password" className="text-xs font-bold uppercase tracking-wider text-gray-700">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs font-semibold text-[var(--color-green)] hover:underline">
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
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-[var(--color-green)] hover:bg-[var(--color-green-dark)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-lg mt-2 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In to VeriBuy</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="mt-8 text-xs text-gray-500 text-center">
          Don&apos;t have a VeriBuy account?{' '}
          <Link href="/register" className="text-[var(--color-green)] font-bold hover:underline">
            Create an account
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
            The Verified Marketplace for Tech Buyers &amp; Sellers
          </h2>

          {/* Benefits */}
          <div className="space-y-4 mb-10">
            {WHY_SIGNIN.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-white/10 text-emerald-300 flex items-center justify-center shrink-0 border border-white/10">
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </div>
                <span className="text-xs font-semibold text-emerald-100">{label}</span>
              </div>
            ))}
          </div>

          {/* Stats Row */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
            <div className="grid grid-cols-3 gap-4 text-center">
              {[
                { value: '50K+', label: 'Verified Devices' },
                { value: '99.4%', label: 'Satisfaction' },
                { value: '£0', label: 'Seller Fees' },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-xl font-black text-emerald-300">{stat.value}</p>
                  <p className="text-[11px] text-emerald-100/70 mt-0.5">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Social Sign-In Email Dialog ── */}
      {socialModalProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-gray-100">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
                {socialModalProvider === 'APPLE' ? (
                  <AppleIcon className="w-6 h-6 fill-black" />
                ) : (
                  <GoogleIcon className="w-6 h-6" />
                )}
              </div>
              <h3 className="text-lg font-black text-gray-900">
                Sign in with {socialModalProvider === 'APPLE' ? 'Apple' : 'Google'}
              </h3>
              <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                Enter your {socialModalProvider === 'APPLE' ? 'Apple ID' : 'Google'} email address to access your verified account.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (socialModalEmail.trim()) {
                  triggerSocialLogin(socialModalProvider, socialModalEmail.trim());
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={socialModalEmail}
                  onChange={(e) => setSocialModalEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSocialModalProvider(null)}
                  disabled={Boolean(socialLoading)}
                  className="flex-1 py-3 px-4 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!socialModalEmail.trim() || Boolean(socialLoading)}
                  className="flex-1 py-3 px-4 bg-black text-white hover:bg-gray-900 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {socialLoading ? 'Verifying...' : 'Sign In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

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
  Sparkles,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

const WHY_SIGNIN = [
  { icon: ShieldCheck, label: '100% Trust Lens™ Verified Hardware' },
  { icon: Lock,        label: 'Stripe Escrow Payment Protection' },
  { icon: RotateCcw,  label: '7-Day Money-Back Return Guarantee' },
  { icon: BadgeCheck,  label: '0% Seller Commission Payouts' },
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
      setError(err.message || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 min-h-[calc(100vh-4rem)] bg-white">
      {/* -- Left: Form -- */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 py-12 max-w-xl mx-auto w-full">
        <div className="mb-8">
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
          <div role="alert" className="flex items-center gap-2.5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

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
    </div>
  );
}

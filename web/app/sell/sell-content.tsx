'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ShieldCheck, Coins, Zap } from 'lucide-react';

export default function SellContent() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section
        aria-labelledby="sell-hero-heading"
        className="relative overflow-hidden text-white"
        style={{ background: 'linear-gradient(135deg, #5C7A3E 0%, #4A6B35 30%, #8B7355 70%, #6B5A3E 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{ background: 'radial-gradient(ellipse at 60% 40%, #F5C842 0%, transparent 60%)' }}
          aria-hidden="true"
        />
        <div className="relative max-w-4xl mx-auto px-4 py-16 md:py-24 text-center">
          <h1
            id="sell-hero-heading"
            className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight mb-4"
          >
            Start Selling on VeriBuy
          </h1>
          <p className="text-base md:text-lg text-white/80 mb-8 max-w-xl mx-auto">
            List your verified devices and reach thousands of trusted buyers
          </p>
          <Link
            href={user ? '/listings/create' : '/register'}
            className="inline-flex items-center gap-2 bg-[var(--color-green)] hover:bg-[var(--color-green-dark)] text-white px-8 py-3.5 rounded-lg font-bold text-base transition-colors shadow-md"
          >
            {user ? 'Create Listing' : 'Get Started'}
          </Link>
        </div>
      </section>

      {/* Benefits */}
      <section
        aria-labelledby="sell-benefits-heading"
        className="max-w-5xl mx-auto px-4 py-14 md:py-16"
      >
        <h2
          id="sell-benefits-heading"
          className="text-2xl md:text-3xl font-bold text-[var(--color-text)] text-center mb-10"
        >
          Why Sell on VeriBuy?
        </h2>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <div className="bg-white rounded-xl p-6 md:p-8 text-center border border-[var(--color-border)]">
            <div className="w-14 h-14 rounded-xl bg-[var(--color-green)]/10 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-7 h-7 text-[var(--color-green)]" aria-hidden="true" />
            </div>
            <h3 className="text-xl font-bold text-[var(--color-text)] mb-3">Trusted Buyers</h3>
            <p className="text-[var(--color-text-muted)]">
              Trust Lens verification builds buyer confidence, leading to faster sales and better prices
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 md:p-8 text-center border border-[var(--color-border)]">
            <div className="w-14 h-14 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center mx-auto mb-4">
              <Coins className="w-7 h-7 text-[var(--color-accent)]" aria-hidden="true" />
            </div>
            <h3 className="text-xl font-bold text-[var(--color-text)] mb-3">Fair Fees</h3>
            <p className="text-[var(--color-text-muted)]">
              Only 5% commission. No listing fees, no monthly charges. Pay only when you sell
            </p>
          </div>
          <div className="bg-white rounded-xl p-6 md:p-8 text-center border border-[var(--color-border)]">
            <div className="w-14 h-14 rounded-xl bg-[var(--color-primary)]/10 flex items-center justify-center mx-auto mb-4">
              <Zap className="w-7 h-7 text-[var(--color-primary)]" aria-hidden="true" />
            </div>
            <h3 className="text-xl font-bold text-[var(--color-text)] mb-3">Fast Payouts</h3>
            <p className="text-[var(--color-text-muted)]">
              Get paid within 24 hours of delivery confirmation. Direct deposit to your bank
            </p>
          </div>
        </div>

        <div className="bg-[var(--color-surface-alt)] rounded-2xl p-8 md:p-10">
          <h3 className="text-2xl font-bold text-[var(--color-text)] mb-6 text-center">
            How It Works
          </h3>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[var(--color-accent)] text-white rounded-full flex items-center justify-center font-bold text-sm">1</div>
              <div>
                <h4 className="font-bold text-[var(--color-text)] mb-1">Create Your Account</h4>
                <p className="text-[var(--color-text-muted)]">Sign up for free and set up your seller profile</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[var(--color-accent)] text-white rounded-full flex items-center justify-center font-bold text-sm">2</div>
              <div>
                <h4 className="font-bold text-[var(--color-text)] mb-1">List Your Device</h4>
                <p className="text-[var(--color-text-muted)]">Add photos, enter IMEI/serial, and describe condition</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[var(--color-accent)] text-white rounded-full flex items-center justify-center font-bold text-sm">3</div>
              <div>
                <h4 className="font-bold text-[var(--color-text)] mb-1">Trust Lens IMEI Check</h4>
                <p className="text-[var(--color-text-muted)]">Your device&apos;s IMEI is checked against blacklist and stolen databases automatically</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[var(--color-accent)] text-white rounded-full flex items-center justify-center font-bold text-sm">4</div>
              <div>
                <h4 className="font-bold text-[var(--color-text)] mb-1">Sell &amp; Ship</h4>
                <p className="text-[var(--color-text-muted)]">Once sold, ship the device and get paid upon delivery</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

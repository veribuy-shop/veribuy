'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export default function SellPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <div className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] text-white py-12 md:py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">Start Selling on VeriBuy</h1>
          <p className="text-lg md:text-xl text-white/90 mb-8">
            List your verified devices and reach thousands of trusted buyers
          </p>
          <Link
            href={user ? '/listings/create' : '/register'}
            className="inline-block bg-white text-[var(--color-primary)] hover:bg-[var(--color-warm-beige)] px-10 py-4 rounded-xl font-bold text-lg transition-all shadow-lg"
          >
            {user ? 'Create Listing' : 'Get Started'}
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12 md:py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-text)] mb-4">
            Why Sell on VeriBuy?
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <div className="bg-white rounded-2xl p-6 md:p-8 text-center shadow-sm border border-[var(--color-border)]">
            <div className="text-4xl mb-4">🛡️</div>
            <h3 className="text-xl font-bold text-[var(--color-text)] mb-3">Trusted Buyers</h3>
            <p className="text-[var(--color-text-muted)]">
              Trust Lens verification builds buyer confidence, leading to faster sales and better prices
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 md:p-8 text-center shadow-sm border border-[var(--color-border)]">
            <div className="text-4xl mb-4">💰</div>
            <h3 className="text-xl font-bold text-[var(--color-text)] mb-3">Fair Fees</h3>
            <p className="text-[var(--color-text-muted)]">
              Only 5% commission. No listing fees, no monthly charges. Pay only when you sell
            </p>
          </div>
          <div className="bg-white rounded-2xl p-6 md:p-8 text-center shadow-sm border border-[var(--color-border)]">
            <div className="text-4xl mb-4">⚡</div>
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
              <div className="flex-shrink-0 w-8 h-8 bg-[var(--color-accent)] text-white rounded-full flex items-center justify-center font-bold">1</div>
              <div>
                <h4 className="font-bold text-[var(--color-text)] mb-1">Create Account & Get Verified</h4>
                <p className="text-[var(--color-text-muted)]">Complete seller verification with ID and contact info</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[var(--color-accent)] text-white rounded-full flex items-center justify-center font-bold">2</div>
              <div>
                <h4 className="font-bold text-[var(--color-text)] mb-1">List Your Device</h4>
                <p className="text-[var(--color-text-muted)]">Add photos, enter IMEI/serial, and describe condition</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[var(--color-accent)] text-white rounded-full flex items-center justify-center font-bold">3</div>
              <div>
                <h4 className="font-bold text-[var(--color-text)] mb-1">Trust Lens Verification</h4>
                <p className="text-[var(--color-text-muted)]">We verify authenticity and assign a condition grade</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-[var(--color-accent)] text-white rounded-full flex items-center justify-center font-bold">4</div>
              <div>
                <h4 className="font-bold text-[var(--color-text)] mb-1">Sell & Ship</h4>
                <p className="text-[var(--color-text-muted)]">Once sold, ship the device and get paid upon delivery</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

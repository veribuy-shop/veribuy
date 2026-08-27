import type { Metadata } from 'next';
import { Check } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pricing & Fees',
  description: 'Simple, fair pricing on VeriBuy. 5% seller commission on successful sales, free for buyers. No listing fees or subscriptions.',
  alternates: {
    canonical: '/pricing',
  },
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section
        aria-labelledby="pricing-hero-heading"
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
            id="pricing-hero-heading"
            className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight mb-4"
          >
            Simple, Fair Pricing
          </h1>
          <p className="text-base md:text-lg text-white/80">
            No hidden fees. Pay only when you sell.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section
        aria-labelledby="pricing-cards-heading"
        className="max-w-4xl mx-auto px-4 py-14 md:py-16"
      >
        <h2 id="pricing-cards-heading" className="sr-only">Pricing Plans</h2>
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Selling Fee */}
          <div className="bg-white rounded-xl p-8 border-2 border-[var(--color-accent)]">
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-[var(--color-accent)] mb-2">5%</div>
              <h3 className="text-2xl font-bold text-[var(--color-text)]">Selling Fee</h3>
            </div>
            <ul className="space-y-3 text-[var(--color-text-muted)]">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 mt-0.5 text-[var(--color-accent)] flex-shrink-0" aria-hidden="true" />
                Only charged on successful sales
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 mt-0.5 text-[var(--color-accent)] flex-shrink-0" aria-hidden="true" />
                No listing fees
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 mt-0.5 text-[var(--color-accent)] flex-shrink-0" aria-hidden="true" />
                No monthly subscriptions
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 mt-0.5 text-[var(--color-accent)] flex-shrink-0" aria-hidden="true" />
                Includes Trust Lens verification
              </li>
            </ul>
          </div>

          {/* Buying Fee */}
          <div className="bg-white rounded-xl p-8 border border-[var(--color-border)]">
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-[var(--color-green)] mb-2">0%</div>
              <h3 className="text-2xl font-bold text-[var(--color-text)]">Buying Fee</h3>
            </div>
            <ul className="space-y-3 text-[var(--color-text-muted)]">
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 mt-0.5 text-[var(--color-green)] flex-shrink-0" aria-hidden="true" />
                Free to browse and buy
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 mt-0.5 text-[var(--color-green)] flex-shrink-0" aria-hidden="true" />
                No platform fees for buyers
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 mt-0.5 text-[var(--color-green)] flex-shrink-0" aria-hidden="true" />
                Secure payment processing
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-5 h-5 mt-0.5 text-[var(--color-green)] flex-shrink-0" aria-hidden="true" />
                7-day buyer protection included
              </li>
            </ul>
          </div>
        </div>

        {/* Fee Example */}
        <div className="bg-[var(--color-surface-alt)] rounded-2xl p-8">
          <h3 className="text-xl font-bold text-[var(--color-text)] mb-6">Fee Example</h3>
          <div className="space-y-3 text-[var(--color-text-muted)]">
            <div className="flex justify-between">
              <span>Item Sale Price:</span>
              <span className="font-semibold">£500.00</span>
            </div>
            <div className="flex justify-between">
              <span>VeriBuy Fee (5%):</span>
              <span className="font-semibold">- £25.00</span>
            </div>
            <div className="border-t border-[var(--color-border)] pt-3 flex justify-between text-[var(--color-text)] font-bold text-lg">
              <span>You Receive:</span>
              <span className="text-[var(--color-accent)]">£475.00</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

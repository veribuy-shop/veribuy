import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing & Fees - VeriBuy',
};

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <div className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] text-white py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">Simple, Fair Pricing</h1>
          <p className="text-lg md:text-xl text-white/90">
            No hidden fees. Pay only when you sell.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white rounded-2xl p-8 shadow-sm border-2 border-[var(--color-accent)]">
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-[var(--color-accent)] mb-2">5%</div>
              <h2 className="text-2xl font-bold text-[var(--color-text)]">Selling Fee</h2>
            </div>
            <ul className="space-y-3 text-[var(--color-text-muted)]">
              <li className="flex items-start gap-3">
                <span className="text-[var(--color-accent)]">✓</span>
                Only charged on successful sales
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--color-accent)]">✓</span>
                No listing fees
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--color-accent)]">✓</span>
                No monthly subscriptions
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--color-accent)]">✓</span>
                Includes Trust Lens verification
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-2xl p-8 shadow-sm border border-[var(--color-border)]">
            <div className="text-center mb-6">
              <div className="text-4xl font-bold text-[var(--color-primary)] mb-2">0%</div>
              <h2 className="text-2xl font-bold text-[var(--color-text)]">Buying Fee</h2>
            </div>
            <ul className="space-y-3 text-[var(--color-text-muted)]">
              <li className="flex items-start gap-3">
                <span className="text-[var(--color-primary)]">✓</span>
                Free to browse and buy
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--color-primary)]">✓</span>
                No platform fees for buyers
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--color-primary)]">✓</span>
                Secure payment processing
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--color-primary)]">✓</span>
                7-day buyer protection included
              </li>
            </ul>
          </div>
        </div>

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
      </div>
    </div>
  );
}

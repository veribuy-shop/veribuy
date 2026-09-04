import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, ShieldCheck, ArrowRight, Lock, Sparkles } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pricing & Fees',
  description: 'Simple, transparent pricing on VeriBuy. 0% seller fees — sellers keep 100% of their money. 5% Buyer Protection fee at checkout.',
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
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 border border-white/20 text-xs font-semibold uppercase tracking-wider text-white mb-6 backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-[var(--color-accent)]" />
            Transparent Marketplace Pricing
          </div>
          <h1
            id="pricing-hero-heading"
            className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight mb-4"
          >
            Simple, Fair Pricing
          </h1>
          <p className="text-base md:text-lg text-white/85 max-w-2xl mx-auto">
            Sellers keep 100% of their sale price. Buyers get complete peace of mind with 5% Buyer Protection.
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
          <div className="bg-white rounded-2xl p-8 border-2 border-[var(--color-green)] shadow-sm hover:shadow-md transition-shadow relative flex flex-col justify-between">
            <div className="absolute top-4 right-4 bg-[var(--color-green)]/10 text-[var(--color-green)] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              For Sellers
            </div>
            <div>
              <div className="text-center mb-6 pt-2">
                <div className="text-5xl font-extrabold text-[var(--color-green)] mb-2">0%</div>
                <h3 className="text-2xl font-bold text-[var(--color-text)]">Selling Fee</h3>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">Keep 100% of your earnings</p>
              </div>
              <ul className="space-y-3.5 text-[var(--color-text-muted)] text-sm md:text-base">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 mt-0.5 text-[var(--color-green)] flex-shrink-0" aria-hidden="true" />
                  <span><strong>Zero commission:</strong> Keep 100% of your listing price</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 mt-0.5 text-[var(--color-green)] flex-shrink-0" aria-hidden="true" />
                  <span>No listing fees or listing limits</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 mt-0.5 text-[var(--color-green)] flex-shrink-0" aria-hidden="true" />
                  <span>No recurring subscriptions or upfront costs</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 mt-0.5 text-[var(--color-green)] flex-shrink-0" aria-hidden="true" />
                  <span>Free Trust Lens IMEI and database checks</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 mt-0.5 text-[var(--color-green)] flex-shrink-0" aria-hidden="true" />
                  <span>Fast payout upon buyer delivery confirmation</span>
                </li>
              </ul>
            </div>
            <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
              <Link
                href="/sell"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[var(--color-green)] hover:bg-[var(--color-green-dark)] text-white font-semibold transition-colors shadow-sm"
              >
                List a Device Free <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Buying Fee */}
          <div className="bg-white rounded-2xl p-8 border-2 border-[var(--color-accent)] shadow-sm hover:shadow-md transition-shadow relative flex flex-col justify-between">
            <div className="absolute top-4 right-4 bg-[var(--color-accent)]/15 text-[var(--color-accent-dark)] text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              For Buyers
            </div>
            <div>
              <div className="text-center mb-6 pt-2">
                <div className="text-5xl font-extrabold text-[var(--color-accent-dark)] mb-2">5%</div>
                <h3 className="text-2xl font-bold text-[var(--color-text)]">Buyer Protection</h3>
                <p className="text-sm text-[var(--color-text-muted)] mt-1">Added transparently at checkout</p>
              </div>
              <ul className="space-y-3.5 text-[var(--color-text-muted)] text-sm md:text-base">
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 mt-0.5 text-[var(--color-accent-dark)] flex-shrink-0" aria-hidden="true" />
                  <span><strong>100% Escrow Protection:</strong> Funds held securely until you confirm item receipt</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 mt-0.5 text-[var(--color-accent-dark)] flex-shrink-0" aria-hidden="true" />
                  <span><strong>Trust Lens Verified:</strong> Hardware inspection &amp; GSMA blacklist check</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 mt-0.5 text-[var(--color-accent-dark)] flex-shrink-0" aria-hidden="true" />
                  <span><strong>7-Day Returns:</strong> Full refund if device doesn&apos;t match description</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 mt-0.5 text-[var(--color-accent-dark)] flex-shrink-0" aria-hidden="true" />
                  <span>Tracked delivery with photo confirmation</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="w-5 h-5 mt-0.5 text-[var(--color-accent-dark)] flex-shrink-0" aria-hidden="true" />
                  <span>Dedicated dispute resolution &amp; support</span>
                </li>
              </ul>
            </div>
            <div className="mt-8 pt-6 border-t border-[var(--color-border)]">
              <Link
                href="/browse"
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[var(--color-accent)] hover:bg-[var(--color-accent-dark)] text-white font-semibold transition-colors shadow-sm"
              >
                Browse Verified Devices <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Fee Example */}
        <div className="bg-[var(--color-surface-alt)] rounded-2xl p-8 border border-[var(--color-border)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-green)]/10 flex items-center justify-center text-[var(--color-green)]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[var(--color-text)]">How Pricing Works in Practice</h3>
              <p className="text-xs md:text-sm text-[var(--color-text-muted)]">Example transaction for a device listed at £500.00</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Seller Perspective */}
            <div className="bg-white rounded-xl p-5 border border-[var(--color-border)]">
              <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--color-green)] mb-3">Seller Breakdown</h4>
              <div className="space-y-2.5 text-sm text-[var(--color-text-muted)]">
                <div className="flex justify-between">
                  <span>Listing Price:</span>
                  <span className="font-semibold text-[var(--color-text)]">£500.00</span>
                </div>
                <div className="flex justify-between">
                  <span>VeriBuy Selling Fee (0%):</span>
                  <span className="font-semibold text-[var(--color-green)]">£0.00</span>
                </div>
                <div className="border-t border-[var(--color-border)] pt-2.5 flex justify-between text-[var(--color-text)] font-bold text-base">
                  <span>Seller Receives:</span>
                  <span className="text-[var(--color-green)]">£500.00 (100%)</span>
                </div>
              </div>
            </div>

            {/* Buyer Perspective */}
            <div className="bg-white rounded-xl p-5 border border-[var(--color-border)]">
              <h4 className="text-sm font-bold uppercase tracking-wider text-[var(--color-accent-dark)] mb-3">Buyer Breakdown</h4>
              <div className="space-y-2.5 text-sm text-[var(--color-text-muted)]">
                <div className="flex justify-between">
                  <span>Item Subtotal:</span>
                  <span className="font-semibold text-[var(--color-text)]">£500.00</span>
                </div>
                <div className="flex justify-between">
                  <span>Buyer Protection Fee (5%):</span>
                  <span className="font-semibold text-[var(--color-text)]">£25.00</span>
                </div>
                <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
                  <span>Shipping:</span>
                  <span>Calculated at checkout</span>
                </div>
                <div className="border-t border-[var(--color-border)] pt-2.5 flex justify-between text-[var(--color-text)] font-bold text-base">
                  <span>Buyer Pays:</span>
                  <span className="text-[var(--color-accent-dark)]">£525.00 + shipping</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

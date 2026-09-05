import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Check,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Lock,
  Percent,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Zap,
  HelpCircle,
} from 'lucide-react';
import { getBuyerProtectionFeePercent, calculateProtectionFee } from '@/lib/fees';
import { formatPrice } from '@/lib/currency';

export const metadata: Metadata = {
  title: 'Pricing & Fees',
  description: 'Simple, transparent pricing on VeriBuy. 0% seller fees — sellers keep 100% of their money. Transparent, variable Buyer Protection fee at checkout.',
  alternates: {
    canonical: '/pricing',
  },
};

export default function PricingPage() {
  const feePercent = getBuyerProtectionFeePercent();
  const examplePrice = 500;
  const exampleFee = calculateProtectionFee(examplePrice);
  const exampleTotal = Math.round((examplePrice + exampleFee) * 100) / 100;

  const platformComparisons = [
    {
      platform: 'VeriBuy',
      sellerFee: '0%',
      sellerPayout: '100% Payout (£500)',
      buyerProtection: `Variable (~${feePercent}%)`,
      imeiCheck: 'Automated 100% of devices',
      escrow: 'Yes (Stripe Escrow)',
      returnWindow: '48-hour (2 days) guarantee',
      isVeriBuy: true,
    },
    {
      platform: 'eBay UK',
      sellerFee: '12.8% + £0.30',
      sellerPayout: '£435.70 (-£64.30)',
      buyerProtection: 'Included in high item prices',
      imeiCheck: 'None (Self-reported)',
      escrow: 'No (Delayed seller holds)',
      returnWindow: 'Varies by seller',
      isVeriBuy: false,
    },
    {
      platform: 'Back Market',
      sellerFee: '10% – 12%',
      sellerPayout: '£440.00 (-£60.00)',
      buyerProtection: 'Built into refurbished markup',
      imeiCheck: 'Merchant self-audited',
      escrow: 'Merchant payout cycle',
      returnWindow: '30 days',
      isVeriBuy: false,
    },
    {
      platform: 'Gumtree / Facebook',
      sellerFee: '0%',
      sellerPayout: 'Cash / Direct Bank Transfer',
      buyerProtection: 'Zero protection',
      imeiCheck: 'None (High scam risk)',
      escrow: 'No escrow',
      returnWindow: 'Sold as seen (No returns)',
      isVeriBuy: false,
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section
        aria-labelledby="pricing-hero-heading"
        className="relative overflow-hidden text-white"
        style={{ background: 'linear-gradient(135deg, #1C2D16 0%, #2D4720 30%, #4A6B35 70%, #2A3B22 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-25"
          style={{ background: 'radial-gradient(circle at 50% 30%, #10B981 0%, transparent 60%)' }}
          aria-hidden="true"
        />
        <div className="relative max-w-4xl mx-auto px-4 py-16 md:py-24 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 mb-6 text-xs font-bold tracking-wide uppercase text-emerald-300 shadow-sm">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Transparent Marketplace Economics</span>
          </div>
          <h1
            id="pricing-hero-heading"
            className="text-3xl sm:text-4xl md:text-5xl font-black leading-tight tracking-tight mb-4 text-white"
          >
            Simple, Fair Pricing.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-emerald-200 to-teal-100">
              0% Seller Commission.
            </span>
          </h1>
          <p className="text-base sm:text-lg text-emerald-100/90 max-w-2xl mx-auto leading-relaxed">
            Sellers keep 100% of their sale price. Buyers get complete peace of mind with 100% escrow protection and automated Trust Lens™ verification.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section
        aria-labelledby="pricing-cards-heading"
        className="max-w-5xl mx-auto px-4 py-14 md:py-16 -mt-10 relative z-10"
      >
        <h2 id="pricing-cards-heading" className="sr-only">Pricing Plans</h2>
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {/* Selling Fee */}
          <div className="bg-white rounded-3xl p-8 md:p-10 border-2 border-emerald-500 shadow-xl relative flex flex-col justify-between">
            <div className="absolute -top-3.5 right-6 bg-[var(--color-green)] text-white text-xs font-black px-4 py-1 rounded-full uppercase tracking-wider shadow-sm">
              For Sellers
            </div>
            <div>
              <div className="text-center mb-8 pt-2">
                <div className="text-6xl font-black text-[var(--color-green)] mb-1 tracking-tight">0%</div>
                <h3 className="text-2xl font-black text-gray-900">Seller Commission</h3>
                <p className="text-sm text-gray-500 mt-1 font-medium">Keep 100% of every sale price</p>
              </div>
              <ul className="space-y-4 text-sm text-gray-700">
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span><strong>Zero platform commission:</strong> Keep £500 on a £500 listing.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span><strong>No listing fees:</strong> List as many phones, tablets, or laptops as you want.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span><strong>Free automated Trust Lens™ checks:</strong> GSMA blacklist and iCloud verification at £0 cost to you.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span><strong>Fast payout release:</strong> Direct bank transfer within 24 hours of buyer inspection approval.</span>
                </li>
              </ul>
            </div>
            <div className="mt-8 pt-6 border-t border-gray-100">
              <Link
                href="/sell"
                className="w-full inline-flex items-center justify-center gap-2 py-4 px-6 rounded-xl bg-[var(--color-green)] hover:bg-[var(--color-green-dark)] text-white font-bold text-sm transition-all shadow-md hover:shadow-lg"
              >
                <span>List a Device for Free</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Buying Fee */}
          <div className="bg-white rounded-3xl p-8 md:p-10 border-2 border-slate-200 shadow-xl relative flex flex-col justify-between">
            <div className="absolute -top-3.5 right-6 bg-slate-900 text-white text-xs font-black px-4 py-1 rounded-full uppercase tracking-wider shadow-sm">
              For Buyers
            </div>
            <div>
              <div className="text-center mb-8 pt-2">
                <div className="text-4xl sm:text-5xl font-black text-gray-900 mb-1 tracking-tight">Variable Rate</div>
                <h3 className="text-2xl font-black text-gray-900">Buyer Protection</h3>
                <p className="text-sm text-gray-500 mt-1 font-medium">Calculated dynamically at checkout</p>
              </div>
              <ul className="space-y-4 text-sm text-gray-700">
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span><strong>100% Escrow Protection:</strong> Funds safely held until you receive and test the device.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span><strong>Trust Lens™ Diagnostic:</strong> GSMA blacklist, stolen registry, and activation locks audited.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span><strong>48-Hour (2 Days) Money-Back Guarantee:</strong> Return for a full refund if item does not match evidence photos.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                  <span><strong>Dedicated UK Dispute Support:</strong> Fast resolution escalation team.</span>
                </li>
              </ul>
            </div>
            <div className="mt-8 pt-6 border-t border-gray-100">
              <Link
                href="/browse"
                className="w-full inline-flex items-center justify-center gap-2 py-4 px-6 rounded-xl bg-gray-900 hover:bg-black text-white font-bold text-sm transition-all shadow-md hover:shadow-lg"
              >
                <span>Browse Verified Devices</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* Fee Example Breakdown */}
        <div className="bg-[var(--color-surface-alt)] rounded-3xl p-8 md:p-10 border border-[var(--color-border)] mb-16 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[var(--color-green)]/15 text-[var(--color-green)] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900">How Pricing Works in Practice</h3>
                <p className="text-xs md:text-sm text-[var(--color-text-muted)]">
                  Transparent math on a device listed at {formatPrice(examplePrice, 'GBP')}
                </p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Seller Perspective */}
            <div className="bg-white rounded-2xl p-6 border border-emerald-200 shadow-xs">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
                <h4 className="text-xs font-black uppercase tracking-wider text-[var(--color-green)]">Seller Payout</h4>
                <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">0% Deductions</span>
              </div>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Device Listing Price:</span>
                  <span className="font-bold text-gray-900">{formatPrice(examplePrice, 'GBP')}</span>
                </div>
                <div className="flex justify-between">
                  <span>VeriBuy Selling Fee:</span>
                  <span className="font-bold text-[var(--color-green)]">£0.00 (0%)</span>
                </div>
                <div className="flex justify-between">
                  <span>Trust Lens™ Verification Fee:</span>
                  <span className="font-bold text-[var(--color-green)]">£0.00</span>
                </div>
                <div className="border-t border-gray-100 pt-3 flex justify-between text-base font-black text-gray-900">
                  <span>Seller Receives:</span>
                  <span className="text-[var(--color-green)]">{formatPrice(examplePrice, 'GBP')} (100%)</span>
                </div>
              </div>
            </div>

            {/* Buyer Perspective */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
                <h4 className="text-xs font-black uppercase tracking-wider text-gray-900">Buyer Protection Total</h4>
                <span className="text-xs font-bold bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-full">Escrow Protected</span>
              </div>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Item Subtotal:</span>
                  <span className="font-bold text-gray-900">{formatPrice(examplePrice, 'GBP')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Buyer Protection Fee (e.g. ~{feePercent}%):</span>
                  <span className="font-bold text-gray-900">{formatPrice(exampleFee, 'GBP')}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Tracked &amp; Insured Shipping:</span>
                  <span>Calculated at checkout</span>
                </div>
                <div className="border-t border-gray-100 pt-3 flex justify-between text-base font-black text-gray-900">
                  <span>Buyer Pays:</span>
                  <span className="text-gray-900">{formatPrice(exampleTotal, 'GBP')} + shipping</span>
                </div>
              </div>
            </div>
          </div>

          <p className="mt-6 text-xs text-gray-500 text-center leading-relaxed">
            * The Buyer Protection fee is dynamically calculated at checkout based on device tier and value, covering escrow security, hardware audit reports, and the 48-hour (2 days) money-back return guarantee.
          </p>
        </div>

        {/* Competitor Platform Comparison Table */}
        <div>
          <div className="text-center max-w-2xl mx-auto mb-8">
            <h3 className="text-2xl font-black text-gray-900 tracking-tight">
              Marketplace Fee Comparison
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              See how VeriBuy saves sellers money while providing superior buyer verification.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-alt)]">
                  <th className="p-4 font-bold text-gray-900">Platform</th>
                  <th className="p-4 font-bold text-gray-900">Seller Fee</th>
                  <th className="p-4 font-bold text-gray-900">£500 Sale Payout</th>
                  <th className="p-4 font-bold text-gray-900">IMEI Check</th>
                  <th className="p-4 font-bold text-gray-900">Escrow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)] text-xs">
                {platformComparisons.map((row) => (
                  <tr
                    key={row.platform}
                    className={row.isVeriBuy ? 'bg-emerald-50/60 font-medium' : 'hover:bg-gray-50/50 transition-colors'}
                  >
                    <td className="p-4 font-bold text-gray-900">
                      {row.isVeriBuy ? (
                        <div className="flex items-center gap-1.5 text-[var(--color-green)] font-black">
                          <ShieldCheck className="w-4 h-4" />
                          <span>{row.platform}</span>
                        </div>
                      ) : (
                        row.platform
                      )}
                    </td>
                    <td className="p-4 font-bold">{row.sellerFee}</td>
                    <td className="p-4">{row.sellerPayout}</td>
                    <td className="p-4">{row.imeiCheck}</td>
                    <td className="p-4">{row.escrow}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

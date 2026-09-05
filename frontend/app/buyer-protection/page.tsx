import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalHeader } from '@/components/legal-nav';
import { ShieldCheck, RefreshCcw, Lock, Scale, CheckCircle2, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Buyer Protection Guarantee',
  description: 'Shop with confidence on VeriBuy. 48-hour returns, escrow payments, Trust Lens verification, and dispute resolution.',
  alternates: {
    canonical: '/buyer-protection',
  },
};

export default function BuyerProtectionPage() {
  const protections = [
    {
      icon: <Lock className="w-6 h-6 text-[var(--color-green)]" />,
      title: '100% Escrow Payment Holding',
      description: 'Your payment is held safely in escrow upon checkout and is only released to the seller after you receive, inspect, and accept the item.',
      benefit: 'Zero risk of seller disappearing without shipping.',
    },
    {
      icon: <RefreshCcw className="w-6 h-6 text-[var(--color-green)]" />,
      title: '48-Hour Money-Back Guarantee',
      description: 'If your device doesn\'t match the listing description, photos, or condition grade, you have 48 hours (2 days) to request a full refund.',
      benefit: 'Full refund including return postage for misrepresented items.',
    },
    {
      icon: <ShieldCheck className="w-6 h-6 text-[var(--color-green)]" />,
      title: 'Trust Lens™ IMEI & Hardware Verification',
      description: 'Every phone, tablet, and wearable is checked against GSMA blacklists, stolen device registries, and cloud activation locks before listings go live.',
      benefit: 'Pre-screened against network blocks and lockouts.',
    },
    {
      icon: <Scale className="w-6 h-6 text-[var(--color-green)]" />,
      title: 'Dedicated Dispute Mediation',
      description: 'If an issue arises, our UK mediation team reviews timestamped Trust Lens™ evidence packs to resolve claims fairly and quickly.',
      benefit: 'Unbiased resolution backed by cryptographic evidence.',
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <LegalHeader
        title="Buyer Protection Guarantee"
        subtitle="Comprehensive protection included on every purchase: escrow payment holding, hardware authentication, and 48-hour (2 days) returns."
        lastUpdated="September 4, 2026"
        badge="100% Guaranteed"
      />

      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        {/* Protection Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {protections.map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-2xl p-6 sm:p-7 border border-[var(--color-border)] shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-[var(--color-green)]/10 flex items-center justify-center mb-4">
                  {item.icon}
                </div>
                <h2 className="text-lg font-bold text-[var(--color-text)] mb-2">{item.title}</h2>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4">
                  {item.description}
                </p>
              </div>

              <div className="pt-3 border-t border-[var(--color-border)]/60 text-xs font-semibold text-[var(--color-green)] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {item.benefit}
              </div>
            </div>
          ))}
        </div>

        {/* How It Works Callout */}
        <div className="bg-white rounded-2xl p-8 border border-[var(--color-border)] shadow-sm">
          <h2 className="text-xl font-bold text-[var(--color-text)] mb-4">How Buyer Protection Works Step-by-Step</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm text-[var(--color-text-muted)]">
            <div className="space-y-2">
              <span className="w-8 h-8 rounded-full bg-[var(--color-green)] text-white text-xs font-black flex items-center justify-center">
                1
              </span>
              <strong className="text-[var(--color-text)] block">Checkout with Escrow</strong>
              <p className="text-xs">Your payment is encrypted and held securely. The seller cannot withdraw funds yet.</p>
            </div>

            <div className="space-y-2">
              <span className="w-8 h-8 rounded-full bg-[var(--color-green)] text-white text-xs font-black flex items-center justify-center">
                2
              </span>
              <strong className="text-[var(--color-text)] block">Tracked Dispatch & Inspection</strong>
              <p className="text-xs">Item arrives via tracked Royal Mail delivery. You have 48 hours (2 days) to test battery, screen, and functions.</p>
            </div>

            <div className="space-y-2">
              <span className="w-8 h-8 rounded-full bg-[var(--color-green)] text-white text-xs font-black flex items-center justify-center">
                3
              </span>
              <strong className="text-[var(--color-text)] block">Release or Return</strong>
              <p className="text-xs">Satisfied? Release funds with 1 click. Found an issue? Open a dispute for a full refund.</p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-4">
            <span className="text-xs text-[var(--color-text-muted)]">
              Questions about an order? Check our <Link href="/help" className="text-[var(--color-green)] font-semibold hover:underline">Help & FAQs</Link>.
            </span>
            <Link
              href="/browse"
              className="px-6 py-2.5 bg-[var(--color-green)] text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity inline-flex items-center gap-1.5 shadow-sm"
            >
              Browse Verified Electronics <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

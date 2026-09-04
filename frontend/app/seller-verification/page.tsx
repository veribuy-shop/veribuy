import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BadgeCheck,
  ShieldCheck,
  Search,
  Package,
  Star,
  Sparkles,
  ArrowRight,
  Radio,
  LockKeyhole,
  CheckCircle2,
  AlertTriangle,
  Fingerprint,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Seller Verification',
  description: 'Learn how seller verification works on VeriBuy. List a device with its IMEI and our Trust Lens system verifies you automatically.',
  alternates: {
    canonical: '/seller-verification',
  },
};

export default function SellerVerificationPage() {
  const steps = [
    {
      icon: Package,
      title: 'List Your Device & IMEI',
      desc: 'Create your listing and provide the 15-digit IMEI number (dial *#06# on mobile phones).',
    },
    {
      icon: Radio,
      title: 'Trust Lens™ Runs Automatically',
      desc: 'Our system queries GSMA global blacklists, police stolen registries, and iCloud activation status in seconds.',
    },
    {
      icon: BadgeCheck,
      title: 'Clean Result = Verified Seller Status',
      desc: 'Once your device passes, your listing publishes instantly and your profile earns the Verified Seller badge.',
    },
    {
      icon: ShieldCheck,
      title: 'Admin Review for Flagged Checks',
      desc: 'If any anomaly is detected, our UK trust and safety team conducts a manual review before activation.',
    },
  ];

  const registryChecks = [
    {
      icon: Radio,
      label: 'GSMA Global Blacklist',
      desc: 'Cross-checks with 44+ international mobile carrier networks to ensure no unpaid carrier debt or network blocks.',
    },
    {
      icon: ShieldCheck,
      label: 'Stolen Property Registry',
      desc: 'Cross-referenced against police and insurance loss databases to ensure legitimate ownership.',
    },
    {
      icon: LockKeyhole,
      label: 'iCloud & Activation Locks',
      desc: 'Ensures Find My and OEM activation locks are disabled so the buyer can perform fresh factory setup.',
    },
    {
      icon: Fingerprint,
      label: 'IMEI Format & Model Integrity',
      desc: 'Cryptographically verifies the Luhn checksum and matches manufacturer specs to the listed model.',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section
        aria-labelledby="sv-hero-heading"
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
            <span>Trust Lens™ Certification</span>
          </div>
          <h1
            id="sv-hero-heading"
            className="text-3xl sm:text-4xl md:text-5xl font-black leading-tight tracking-tight mb-4 text-white"
          >
            How Seller Verification Works
          </h1>
          <p className="text-base sm:text-lg text-emerald-100/90 max-w-2xl mx-auto leading-relaxed">
            List an authentic device with its verified IMEI, and our automated Trust Lens™ system validates your hardware and awards Verified Seller status.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-5xl mx-auto px-4 py-14 md:py-16 -mt-10 relative z-10">
        <div className="space-y-8">
          {/* How It Works Card */}
          <div className="bg-white rounded-3xl p-8 md:p-10 border border-[var(--color-border)] shadow-md">
            <div className="max-w-2xl mb-8">
              <span className="text-xs font-bold text-[var(--color-green)] uppercase tracking-wider block mb-1">
                Automated Trust Flow
              </span>
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">Built into the Listing Process</h2>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                You do not need to fill out separate paperwork or wait days for manual identity approval. Verification occurs in real-time when you input your device&apos;s IMEI and submit timestamped evidence photos.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {steps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="bg-[var(--color-surface-alt)] rounded-2xl p-5 border border-gray-100 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[var(--color-green)] flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-gray-900 mb-1">{step.title}</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* What We Check */}
          <div className="bg-white rounded-3xl p-8 md:p-10 border border-[var(--color-border)] shadow-md">
            <h2 className="text-2xl font-black text-gray-900 mb-6 tracking-tight">
              What Trust Lens™ Audits
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {registryChecks.map((item) => {
                const CheckIcon = item.icon;
                return (
                  <div key={item.label} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-gray-800 flex items-center justify-center shrink-0">
                      <CheckIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-900 mb-1">{item.label}</p>
                      <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Staying Verified */}
          <div className="bg-white rounded-3xl p-8 md:p-10 border border-[var(--color-border)] shadow-md">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 mb-2">Maintaining Verified Seller Standing</h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Once verified, your Verified Seller badge carries forward across all your listings. However, if a seller repeatedly submits invalid IMEIs, blacklisted items, or falsely graded hardware, their seller privileges are immediately frozen to safeguard marketplace integrity.
                </p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 rounded-3xl p-8 md:p-12 text-white text-center shadow-xl">
            <h3 className="text-2xl md:text-3xl font-black mb-3 text-white tracking-tight">
              Ready to Sell with 0% Fees?
            </h3>
            <p className="text-emerald-100/80 text-sm max-w-lg mx-auto mb-6">
              Create your listing in 3 minutes. Keep 100% of your payout with zero commission.
            </p>
            <Link
              href="/listings/create"
              className="inline-flex items-center gap-2 bg-[var(--color-green)] hover:bg-[var(--color-green-dark)] text-white px-8 py-3.5 rounded-xl font-bold text-sm transition-colors shadow-lg"
            >
              <span>Create Your First Listing</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

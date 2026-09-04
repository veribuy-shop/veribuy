import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ShieldCheck,
  UserCheck,
  Search,
  Camera,
  RotateCcw,
  Lock,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Cpu,
  BadgeCheck,
  Zap,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'How Trust Lens Works',
  description: 'Learn how our verification process ensures every device is authentic and accurately described',
  alternates: {
    canonical: '/how-it-works',
  },
};

export default function HowItWorksPage() {
  const steps = [
    {
      number: '01',
      title: 'Seller Lists Device & IMEI',
      icon: UserCheck,
      badge: 'Step 1: Listing',
      description: 'The seller enters brand, model, storage, cosmetic condition grade (A/B/C), and verified 15-digit IMEI number with timestamped evidence photos.',
      details: [
        'Enter device brand, model, storage, and colour',
        'Upload multi-angle evidence photos (screen, casing, settings)',
        'Select verified condition grade: A (Excellent), B (Good), or C (Fair)',
        'Provide IMEI by dialling *#06# on the device',
      ],
    },
    {
      number: '02',
      title: 'Automated Trust Lens™ Check',
      icon: Cpu,
      badge: 'Step 2: Verification',
      description: 'Our automated algorithms query global mobile databases in real-time to audit hardware authenticity, blacklist status, and activation locks.',
      details: [
        'GSMA global carrier blacklist verification (44+ carrier networks)',
        'Stolen & lost property registry cross-reference',
        'iCloud & Find My activation lock verification (Apple devices)',
        'IMEI cryptographic checksum & model matching',
      ],
    },
    {
      number: '03',
      title: '100% Escrow Holding Checkout',
      icon: Lock,
      badge: 'Step 3: Secure Checkout',
      description: 'When a buyer purchases, the payment is securely locked in Stripe escrow. The seller never receives funds upfront, guaranteeing complete buyer protection.',
      details: [
        'Payment locked safely in platform escrow',
        'Seller receives immediate dispatch notification',
        'Tracked courier delivery with signature required upon arrival',
        'Transparent variable Buyer Protection fee at checkout',
      ],
    },
    {
      number: '04',
      title: '7-Day Inspection & Release',
      icon: RotateCcw,
      badge: 'Step 4: Inspection',
      description: 'The buyer has 7 full days to inspect the physical device against the timestamped evidence pack. Once satisfied, funds release to the seller with £0 seller commission.',
      details: [
        '7-day hands-on testing window for the buyer',
        'Timestamped evidence photos used for objective dispute support',
        'Full 100% refund guarantee if device is misrepresented',
        'Instant seller payout upon buyer confirmation',
      ],
    },
  ];

  const highlights = [
    {
      icon: ShieldCheck,
      title: '100% Verified Hardware',
      desc: 'No unverified classifieds. Every single device has its IMEI and blacklist record audited.',
    },
    {
      icon: Lock,
      title: 'Escrow Protection',
      desc: 'Funds are held in secure escrow. Sellers cannot withdraw until the buyer confirms delivery.',
    },
    {
      icon: Zap,
      title: '0% Seller Commission',
      desc: 'Sellers keep 100% of their earnings with zero listing fees and fast payouts.',
    },
    {
      icon: BadgeCheck,
      title: 'Evidence Audit Trail',
      desc: 'Timestamped photo evidence protects both parties against fraudulent condition claims.',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section
        aria-labelledby="how-hero-heading"
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
            <span>The VeriBuy Verification Standard</span>
          </div>
          <h1
            id="how-hero-heading"
            className="text-3xl sm:text-4xl md:text-5xl font-black leading-tight tracking-tight mb-4 text-white"
          >
            How Trust Lens™ Protects<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-emerald-200 to-teal-100">
              Every Device &amp; Transaction
            </span>
          </h1>
          <p className="text-base sm:text-lg text-emerald-100/90 max-w-2xl mx-auto leading-relaxed">
            Eliminating scams, blacklisted electronics, and hidden defects through automated IMEI checks, escrow holding, and 7-day inspection windows.
          </p>
        </div>
      </section>

      {/* Trust Highlights Grid */}
      <section className="max-w-6xl mx-auto px-4 -mt-8 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {highlights.map((item) => {
            const ItemIcon = item.icon;
            return (
              <div
                key={item.title}
                className="bg-white rounded-2xl p-5 border border-[var(--color-border)] shadow-md hover:shadow-lg transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[var(--color-green)] flex items-center justify-center mb-3">
                    <ItemIcon className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-sm text-[var(--color-text)] mb-1">{item.title}</h3>
                  <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Steps */}
      <section
        aria-labelledby="steps-heading"
        className="max-w-5xl mx-auto px-4 py-16 md:py-20"
      >
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold text-[var(--color-green)] uppercase tracking-wider block mb-1">
            End-to-End Workflow
          </span>
          <h2 id="steps-heading" className="text-2xl sm:text-3xl font-black text-[var(--color-text)] tracking-tight">
            The 4-Stage Trust Lens™ Journey
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">
            Every step is designed to give buyers 100% confidence and sellers 0% fee payouts.
          </p>
        </div>

        <div className="space-y-6 md:space-y-8">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="bg-white rounded-2xl p-6 md:p-8 border border-[var(--color-border)] shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row gap-6 md:gap-8 items-start">
                  {/* Step Number & Icon */}
                  <div className="flex items-center gap-4 md:flex-col md:items-center md:justify-center shrink-0">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-emerald-900 to-emerald-950 text-emerald-300 flex items-center justify-center shadow-inner">
                      <Icon className="w-8 h-8 md:w-10 md:h-10" aria-hidden="true" />
                    </div>
                    <span className="text-2xl md:text-3xl font-black text-emerald-700/40">{step.number}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-2">
                      <span>{step.badge}</span>
                    </div>
                    <h3 className="text-xl md:text-2xl font-black text-gray-900 mb-2">
                      {step.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-5 leading-relaxed">
                      {step.description}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {step.details.map((detail, i) => (
                        <div key={i} className="flex items-start gap-2 bg-[var(--color-surface-alt)] p-2.5 rounded-xl border border-gray-100">
                          <CheckCircle2 className="w-4 h-4 text-[var(--color-green)] shrink-0 mt-0.5" aria-hidden="true" />
                          <span className="text-xs font-medium text-gray-700 leading-snug">{detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA Banner */}
        <div className="mt-16 bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 rounded-3xl p-8 md:p-12 text-white text-center shadow-xl">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 mb-4 mx-auto">
            <ShieldCheck className="w-7 h-7 text-emerald-300" />
          </div>
          <h3 className="text-2xl md:text-3xl font-black mb-3 text-white tracking-tight">
            Ready to Buy or Sell with Complete Confidence?
          </h3>
          <p className="text-sm sm:text-base text-emerald-100/80 mb-8 max-w-xl mx-auto">
            Join thousands of verified buyers and sellers on the UK&apos;s most secure pre-owned electronics marketplace.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/browse"
              className="bg-[var(--color-green)] hover:bg-[var(--color-green-dark)] text-white px-8 py-3.5 rounded-xl font-bold text-sm transition-colors shadow-lg inline-flex items-center justify-center gap-2"
            >
              <span>Browse Verified Devices</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/sell"
              className="bg-white/15 hover:bg-white/25 border border-white/30 text-white px-8 py-3.5 rounded-xl font-bold text-sm transition-colors inline-flex items-center justify-center"
            >
              Start Selling with 0% Fees
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

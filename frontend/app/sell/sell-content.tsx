'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  ShieldCheck,
  Coins,
  Zap,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Lock,
  RotateCcw,
  Truck,
  Cpu,
  BadgeCheck,
} from 'lucide-react';

export default function SellContent() {
  const { user } = useAuth();

  const sellerPerks = [
    {
      icon: Coins,
      title: '0% Seller Commission',
      desc: 'Keep 100% of your listed price. No hidden listing fees, no insertion charges, and no final value deductions.',
    },
    {
      icon: ShieldCheck,
      title: 'Trust Lens™ Verification',
      desc: 'Automated IMEI checks build instant buyer trust, resulting in faster sales and fewer lowball offers.',
    },
    {
      icon: Zap,
      title: '24-Hour Fast Payouts',
      desc: 'Funds held in escrow are released directly to your UK bank account within 24 hours of buyer inspection approval.',
    },
    {
      icon: Lock,
      title: 'Protected Against Scams',
      desc: 'Timestamped evidence pack and escrow holding protect you from chargebacks, false disputes, and buyer fraud.',
    },
  ];

  const sellerSteps = [
    {
      step: '01',
      title: 'List in Under 3 Minutes',
      desc: 'Select your device model, upload clear photos, select condition grade (A/B/C), and enter the IMEI (*#06#).',
    },
    {
      step: '02',
      title: 'Instant Automated Verification',
      desc: 'Trust Lens runs GSMA blacklist and iCloud lock checks automatically. Clean devices go live instantly.',
    },
    {
      step: '03',
      title: 'Ship with Tracked Courier',
      desc: 'Once purchased, the buyer payment is locked in escrow. Pack securely and ship with tracked delivery.',
    },
    {
      step: '04',
      title: 'Receive 100% Payout',
      desc: 'After the 7-day inspection window, receive your full sale price with zero commission deducted.',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section
        aria-labelledby="sell-hero-heading"
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
            <span>0% Commission Marketplace</span>
          </div>
          <h1
            id="sell-hero-heading"
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black leading-tight tracking-tight mb-4 text-white"
          >
            Sell Your Electronics.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-emerald-200 to-teal-100">
              Keep 100% of Your Money.
            </span>
          </h1>
          <p className="text-base sm:text-lg text-emerald-100/90 mb-8 max-w-xl mx-auto leading-relaxed">
            Reach thousands of trusted buyers with automated Trust Lens™ hardware verification and guaranteed escrow protection.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href={user ? '/listings/create' : '/register?redirect=/listings/create'}
              className="inline-flex items-center justify-center gap-2 bg-[var(--color-green)] hover:bg-[var(--color-green-dark)] text-white px-8 py-4 rounded-xl font-black text-sm transition-all shadow-lg hover:shadow-xl"
            >
              <span>{user ? 'Create a Listing Now' : 'Start Selling for Free'}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/seller-verification"
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/30 text-white px-6 py-4 rounded-xl font-bold text-sm transition-colors"
            >
              Learn About Verification
            </Link>
          </div>
        </div>
      </section>

      {/* Seller Perks Grid */}
      <section
        aria-labelledby="sell-benefits-heading"
        className="max-w-6xl mx-auto px-4 py-16 -mt-8 relative z-10"
      >
        <h2 id="sell-benefits-heading" className="sr-only">Seller Benefits</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {sellerPerks.map((perk) => {
            const PerkIcon = perk.icon;
            return (
              <div
                key={perk.title}
                className="bg-white rounded-3xl p-6 border border-[var(--color-border)] shadow-md hover:shadow-lg transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[var(--color-green)] flex items-center justify-center mb-4">
                    <PerkIcon className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-black text-gray-900 mb-2">{perk.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{perk.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4-Step How Selling Works */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="bg-[var(--color-surface-alt)] rounded-3xl p-8 md:p-12 border border-[var(--color-border)] shadow-sm">
          <div className="text-center max-w-xl mx-auto mb-10">
            <span className="text-xs font-bold text-[var(--color-green)] uppercase tracking-wider block mb-1">
              Simple 4-Step Process
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
              How Selling on VeriBuy Works
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {sellerSteps.map((step) => (
              <div key={step.step} className="bg-white rounded-2xl p-6 border border-gray-100 shadow-xs flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[var(--color-green)] font-black text-base flex items-center justify-center shrink-0">
                  {step.step}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900 mb-1">{step.title}</h4>
                  <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 pt-8 border-t border-gray-200 text-center">
            <Link
              href={user ? '/listings/create' : '/register?redirect=/listings/create'}
              className="inline-flex items-center gap-2 bg-gray-900 hover:bg-black text-white px-8 py-3.5 rounded-xl font-bold text-sm transition-colors shadow-md"
            >
              <span>Get Started &bull; List in 3 Minutes</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

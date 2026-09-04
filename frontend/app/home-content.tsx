'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ListingCard } from '@/components/listing-card';
import {
  ShieldCheck,
  ArrowRight,
  Search,
  Lock,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Smartphone,
  Tablet,
  Laptop,
  Watch,
  Gamepad2,
  Sparkles,
  Zap,
  Award,
  Cpu,
  FileCheck2,
  Percent,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Data                                                              */
/* ------------------------------------------------------------------ */

const categories = [
  { name: 'Smartphones', href: '/browse?category=smartphones', icon: Smartphone, tag: 'Most Popular', count: 'iPhone, Galaxy, Pixel' },
  { name: 'Tablets',     href: '/browse?category=tablets',     icon: Tablet,     tag: 'Verified iPads', count: 'iPad Pro, Air, Mini' },
  { name: 'Laptops',     href: '/browse?category=laptops',     icon: Laptop,     tag: 'MacBook & PC', count: 'Apple Silicon & Windows' },
  { name: 'Smartwatches',href: '/browse?category=smartwatches',icon: Watch,      tag: 'Apple & Garmin', count: 'Series 9, Ultra, Galaxy' },
  { name: 'Gaming',      href: '/browse?category=gaming',      icon: Gamepad2,   tag: 'Consoles', count: 'PS5, Switch, Steam Deck' },
  { name: 'All Devices', href: '/browse',                      icon: Sparkles,   tag: 'Browse All', count: 'View Entire Catalog' },
];

const verificationSteps = [
  {
    step: '01',
    icon: FileCheck2,
    title: 'Seller Lists Device',
    description: 'Seller inputs model, condition grade (A/B/C), and verified 15-digit IMEI with timestamped evidence photos.',
  },
  {
    step: '02',
    icon: Cpu,
    title: 'Trust Lens™ Authentication',
    description: 'Automated algorithms check GSMA international blacklists, police stolen registries, and cloud lock status.',
  },
  {
    step: '03',
    icon: Lock,
    title: '100% Escrow Checkout',
    description: 'Buyer payment is locked safely in Stripe escrow. The seller cannot withdraw funds until delivery is verified.',
  },
  {
    step: '04',
    icon: RotateCcw,
    title: '7-Day Inspection Window',
    description: 'Buyer tests the device for 7 days. Once satisfied, escrow funds release to the seller with £0 seller commission.',
  },
];

const comparisonPoints = [
  {
    feature: 'IMEI & GSMA Blacklist Verification',
    veribuy: 'Automated on 100% of listings before going live',
    others: 'None (high risk of blacklisted or stolen items)',
  },
  {
    feature: 'Payment Security',
    veribuy: '100% Escrow holding until you inspect the device',
    others: 'Bank transfer / cash with zero buyer protection',
  },
  {
    feature: 'Money-Back Guarantee',
    veribuy: '7-day full refund guarantee on misrepresented items',
    others: 'Sold as seen (no returns, no recourse)',
  },
  {
    feature: 'Seller Fees',
    veribuy: '0% seller commission (sellers keep 100% payout)',
    others: '10% – 15% platform fees eating into profits',
  },
  {
    feature: 'Hardware Evidence & Audit Trail',
    veribuy: 'Timestamped photo evidence & battery health records',
    others: 'Generic stock photos and undisclosed defects',
  },
];

const featuredListings = [
  {
    id: '1',
    href: '/browse?category=smartphones',
    title: 'iPhone 14 Pro Max 256GB - Space Black',
    imageUrl: '/images/products/iphone-14-pro.jpg',
    conditionGrade: 'A' as const,
    conditionLabel: 'Pristine / Battery 94%',
    price: 799,
    originalPrice: 1199,
    brand: 'Apple',
    model: 'iPhone 14 Pro Max',
  },
  {
    id: '2',
    href: '/browse?category=smartphones',
    title: 'Samsung Galaxy S23 Ultra 512GB - Phantom Black',
    imageUrl: '/images/products/samsung-galaxy-s23.jpg',
    conditionGrade: 'A' as const,
    conditionLabel: 'Like New / Unlocked',
    price: 699,
    originalPrice: 1249,
    brand: 'Samsung',
    model: 'Galaxy S23 Ultra',
  },
  {
    id: '3',
    href: '/browse?category=laptops',
    title: 'MacBook Pro 14" M2 Pro 16GB / 512GB',
    imageUrl: '/images/products/macbook-pro.jpg',
    conditionGrade: 'A' as const,
    conditionLabel: 'Flawless Casing / 100% Battery',
    price: 1399,
    originalPrice: 1999,
    brand: 'Apple',
    model: 'MacBook Pro 14"',
  },
  {
    id: '4',
    href: '/browse?category=tablets',
    title: 'iPad Air 5th Gen 256GB Wi-Fi - Starlight',
    imageUrl: '/images/products/ipad-air.jpg',
    conditionGrade: 'B' as const,
    conditionLabel: 'Good Condition / Box Included',
    price: 489,
    originalPrice: 699,
    brand: 'Apple',
    model: 'iPad Air',
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function HomeContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [heroSearch, setHeroSearch] = useState('');

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (heroSearch.trim()) {
      router.push(`/browse?search=${encodeURIComponent(heroSearch.trim())}`);
    } else {
      router.push('/browse');
    }
  };

  return (
    <div className="min-h-screen bg-white">

      {/* ============================================================ */}
      {/* HERO SECTION                                                 */}
      {/* ============================================================ */}
      <section
        aria-labelledby="hero-heading"
        className="relative overflow-hidden text-white"
        style={{ background: 'linear-gradient(135deg, #1C2D16 0%, #2D4720 30%, #4A6B35 70%, #2A3B22 100%)' }}
      >
        {/* Glow overlay */}
        <div
          className="absolute inset-0 opacity-25"
          style={{ background: 'radial-gradient(circle at 50% 30%, #10B981 0%, transparent 60%)' }}
          aria-hidden="true"
        />

        <div className="relative max-w-5xl mx-auto px-4 pt-20 pb-24 text-center">
          {/* Trust Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 mb-6 text-xs font-bold tracking-wide uppercase text-emerald-300 shadow-sm">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>The Verified Marketplace for Pre-Owned Electronics</span>
          </div>

          <h1
            id="hero-heading"
            className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight tracking-tight mb-6 text-white"
          >
            Buy &amp; Sell Electronics<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-emerald-200 to-teal-100">
              With 100% Escrow Protection
            </span>
          </h1>

          <p className="text-base sm:text-lg text-emerald-100/90 mb-8 max-w-2xl mx-auto leading-relaxed">
            Every device has its IMEI, cloud lock status, and hardware authenticated before going live. Zero scams. Zero hidden defects.
          </p>

          {/* Hero Instant Search Bar */}
          <form onSubmit={handleHeroSearch} className="max-w-xl mx-auto mb-10">
            <div className="relative flex items-center bg-white rounded-2xl shadow-xl p-2 border border-white/30">
              <Search className="w-5 h-5 text-gray-400 ml-3 shrink-0" aria-hidden="true" />
              <input
                type="text"
                value={heroSearch}
                onChange={(e) => setHeroSearch(e.target.value)}
                placeholder="Search iPhone 14, MacBook Pro, Galaxy S23..."
                className="w-full px-4 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none font-medium bg-transparent"
              />
              <button
                type="submit"
                className="bg-[var(--color-green)] hover:bg-[var(--color-green-dark)] text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-colors shadow-sm shrink-0"
              >
                Search
              </button>
            </div>
          </form>

          {/* Trust Pillar Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-3xl mx-auto text-xs font-semibold text-emerald-100">
            <div className="flex items-center justify-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl py-2.5 px-3">
              <Lock className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>100% Escrow Protection</span>
            </div>
            <div className="flex items-center justify-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl py-2.5 px-3">
              <RotateCcw className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>7-Day Money-Back Guarantee</span>
            </div>
            <div className="flex items-center justify-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl py-2.5 px-3">
              <Percent className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>0% Seller Commission</span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* SHOP BY CATEGORY                                              */}
      {/* ============================================================ */}
      <section
        aria-labelledby="categories-heading"
        className="max-w-6xl mx-auto px-4 py-16"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8">
          <div>
            <h2
              id="categories-heading"
              className="text-2xl sm:text-3xl font-black text-[var(--color-text)] tracking-tight"
            >
              Shop by Category
            </h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Browse pre-inspected electronics categorized by device tier.
            </p>
          </div>
          <Link
            href="/browse"
            className="text-sm font-bold text-[var(--color-green)] hover:underline inline-flex items-center gap-1 mt-2 sm:mt-0"
          >
            Explore all devices <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.name}
                href={cat.href}
                className="group flex flex-col items-center justify-between bg-white rounded-2xl p-5 border border-[var(--color-border)] hover:border-[var(--color-green)] hover:shadow-lg transition-all duration-200 text-center"
              >
                <div className="w-14 h-14 rounded-2xl bg-[var(--color-surface-alt)] group-hover:bg-[var(--color-green)]/15 group-hover:scale-110 flex items-center justify-center transition-all duration-200 mb-3 text-[var(--color-text)] group-hover:text-[var(--color-green)]">
                  <Icon className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[var(--color-text)] mb-0.5">
                    {cat.name}
                  </h3>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    {cat.count}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ============================================================ */}
      {/* FEATURED VERIFIED LISTINGS                                    */}
      {/* ============================================================ */}
      <section
        aria-labelledby="listings-heading"
        className="max-w-6xl mx-auto px-4 pb-16"
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Just Verified</span>
            </div>
            <h2
              id="listings-heading"
              className="text-2xl sm:text-3xl font-black text-[var(--color-text)] tracking-tight"
            >
              Featured Verified Devices
            </h2>
          </div>
          <Link
            href="/browse"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--color-green)] hover:underline"
          >
            View All ({featuredListings.length}+)
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredListings.map((listing) => (
            <ListingCard key={listing.id} {...listing} />
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* HOW TRUST LENS WORKS                                          */}
      {/* ============================================================ */}
      <section
        aria-labelledby="trust-lens-heading"
        className="bg-[var(--color-surface-alt)] py-16 border-y border-[var(--color-border)]"
      >
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-bold text-[var(--color-green)] uppercase tracking-wider block mb-1">
              Complete Protection Protocol
            </span>
            <h2
              id="trust-lens-heading"
              className="text-2xl sm:text-3xl font-black text-[var(--color-text)] tracking-tight"
            >
              How Trust Lens™ Protects You
            </h2>
            <p className="text-[var(--color-text-muted)] text-sm sm:text-base mt-2">
              Our 4-stage verification eliminates the fear of fake, blacklisted, or defective hardware.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {verificationSteps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.step}
                  className="bg-white rounded-2xl p-6 border border-[var(--color-border)] shadow-sm hover:shadow-md transition-shadow relative flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-2xl font-black text-[var(--color-green)]/30">
                        {step.step}
                      </span>
                      <div className="w-10 h-10 rounded-xl bg-[var(--color-surface-alt)] flex items-center justify-center text-[var(--color-green)]">
                        <Icon className="w-5 h-5" />
                      </div>
                    </div>
                    <h3 className="font-bold text-base text-[var(--color-text)] mb-2">
                      {step.title}
                    </h3>
                    <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* VERIBUY VS CLASSIFIEDS COMPARISON                             */}
      {/* ============================================================ */}
      <section
        aria-labelledby="comparison-heading"
        className="max-w-5xl mx-auto px-4 py-16"
      >
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2
            id="comparison-heading"
            className="text-2xl sm:text-3xl font-black text-[var(--color-text)] tracking-tight"
          >
            Why Buy on VeriBuy vs. Unverified Classifieds?
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            See why buyers and sellers choose VeriBuy over Gumtree, Facebook Marketplace, or eBay.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border border-[var(--color-border)] rounded-2xl overflow-hidden shadow-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="p-4 bg-[var(--color-surface-alt)] font-bold text-[var(--color-text)]">Guarantee / Feature</th>
                <th className="p-4 bg-[var(--color-green)]/15 font-black text-[var(--color-green)] border-x border-[var(--color-green)]/30">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-5 h-5" />
                    <span>VeriBuy Marketplace</span>
                  </div>
                </th>
                <th className="p-4 bg-gray-100 font-bold text-gray-500">Unverified Classifieds</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] text-xs">
              {comparisonPoints.map((row) => (
                <tr key={row.feature} className="hover:bg-[var(--color-surface-alt)]/50 transition-colors">
                  <td className="p-4 font-bold text-[var(--color-text)]">{row.feature}</td>
                  <td className="p-4 bg-[var(--color-green)]/5 font-semibold text-[var(--color-text)] border-x border-[var(--color-green)]/20">
                    <div className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-[var(--color-green)] shrink-0 mt-0.5" />
                      <span>{row.veribuy}</span>
                    </div>
                  </td>
                  <td className="p-4 text-[var(--color-text-muted)]">
                    <div className="flex items-start gap-1.5">
                      <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                      <span>{row.others}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ============================================================ */}
      {/* CTA SECTION                                                   */}
      {/* ============================================================ */}
      <section
        aria-labelledby="cta-heading"
        className="bg-[var(--color-primary)] py-16 text-center text-white"
      >
        <div className="max-w-3xl mx-auto px-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mx-auto mb-4">
            <Zap className="w-7 h-7 text-emerald-300" />
          </div>
          <h2
            id="cta-heading"
            className="text-2xl sm:text-4xl font-black mb-3 text-white tracking-tight"
          >
            Ready to Buy or Sell With Total Confidence?
          </h2>
          <p className="text-white/80 text-sm sm:text-base mb-8 max-w-xl mx-auto">
            Join the verified electronics marketplace. Clean IMEI checks, escrow payments, and £0 seller commission.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/browse"
              className="bg-[var(--color-green)] hover:bg-[var(--color-green-dark)] text-white px-8 py-3.5 rounded-xl font-bold text-sm transition-colors shadow-lg"
            >
              Browse Verified Devices
            </Link>
            <Link
              href="/listings/create"
              className="bg-white/15 hover:bg-white/25 border border-white/30 text-white px-8 py-3.5 rounded-xl font-bold text-sm transition-colors"
            >
              Sell With 0% Commission
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

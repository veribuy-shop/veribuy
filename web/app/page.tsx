'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ListingCard } from '@/components/listing-card';
import { ShieldCheck, ArrowRight } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const categories = [
  { name: 'Phones',  href: '/browse?category=smartphones', emoji: '📱' },
  { name: 'Tablets', href: '/browse?category=tablets',     emoji: '📟' },
  { name: 'Laptops', href: '/browse?category=laptops',     emoji: '💻' },
  { name: 'Watches', href: '/browse?category=smartwatches',emoji: '⌚' },
  { name: 'Gaming',  href: '/browse?category=gaming',      emoji: '🎮' },
  { name: 'More',    href: '/browse',                       emoji: '✨' },
];

const verificationSteps = [
  {
    emoji: '✅',
    step: 'Step 1',
    title: 'Seller Verified',
    description: 'Identity checked before listing',
  },
  {
    emoji: '🔍',
    step: 'Step 2',
    title: 'Device Checked',
    description: 'IMEI & serial validated',
  },
  {
    emoji: '📸',
    step: 'Step 3',
    title: 'Photos Captured',
    description: 'Timestamped evidence stored',
  },
  {
    emoji: '⭐',
    step: 'Step 4',
    title: 'Grade Assigned',
    description: 'Condition rated A/B/C',
  },
];

const featuredListings = [
  {
    id: '1',
    href: '/browse?category=smartphones',
    title: 'iPhone 14 Pro 256GB',
    imageUrl: '/images/products/iphone-14-pro.jpg',
    conditionGrade: 'A' as const,
    conditionLabel: 'Excellent condition',
    price: 899,
    originalPrice: 1199,
    brand: 'Apple',
    model: 'iPhone 14 Pro',
  },
  {
    id: '2',
    href: '/browse?category=smartphones',
    title: 'Galaxy S23 Ultra 512GB',
    imageUrl: '/images/products/samsung-galaxy-s23.jpg',
    conditionGrade: 'B' as const,
    conditionLabel: 'Good condition',
    price: 749,
    originalPrice: 1149,
    brand: 'Samsung',
    model: 'Galaxy S23 Ultra',
  },
  {
    id: '3',
    href: '/browse?category=laptops',
    title: 'MacBook Pro 14" M2',
    imageUrl: '/images/products/macbook-pro.jpg',
    conditionGrade: 'A' as const,
    conditionLabel: 'Like new',
    price: 1699,
    originalPrice: 2149,
    brand: 'Apple',
    model: 'MacBook Pro 14"',
  },
  {
    id: '4',
    href: '/browse?category=tablets',
    title: 'iPad Air 5th Gen 256GB',
    imageUrl: '/images/products/ipad-air.jpg',
    conditionGrade: 'A' as const,
    conditionLabel: 'Excellent condition',
    price: 549,
    originalPrice: 749,
    brand: 'Apple',
    model: 'iPad Air',
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white">

      {/* ============================================================ */}
      {/* HERO                                                         */}
      {/* ============================================================ */}
      <section
        aria-labelledby="hero-heading"
        className="relative overflow-hidden text-white"
        style={{ background: 'linear-gradient(135deg, #5C7A3E 0%, #4A6B35 30%, #8B7355 70%, #6B5A3E 100%)' }}
      >
        {/* Subtle radial highlight */}
        <div
          className="absolute inset-0 opacity-20"
          style={{ background: 'radial-gradient(ellipse at 60% 40%, #F5C842 0%, transparent 60%)' }}
          aria-hidden="true"
        />

        <div className="relative max-w-4xl mx-auto px-4 py-20 md:py-28 text-center">
          <h1
            id="hero-heading"
            className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-4"
          >
            Buy &amp; Sell Electronics<br />You Can Trust
          </h1>

          <p className="text-base md:text-lg text-white/80 mb-8 max-w-xl mx-auto">
            Every device verified before it goes live. No fakes, no surprises, just honest deals.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-wrap gap-3 justify-center mb-10">
            <Link
              href="/browse"
              className="inline-flex items-center gap-2 bg-[var(--color-green)] hover:bg-[var(--color-green-dark)] text-white px-7 py-3 rounded-lg font-semibold text-base transition-colors shadow-md"
            >
              Browse Devices
            </Link>
            <Link
              href="/sell"
              className="inline-flex items-center gap-2 border-2 border-white/70 hover:border-white text-white px-7 py-3 rounded-lg font-semibold text-base transition-colors"
            >
              Start Selling
            </Link>
          </div>

          {/* Trust Lens badge */}
          <div className="inline-flex items-center gap-2.5 bg-white/15 backdrop-blur-sm border border-white/25 rounded-xl px-5 py-3">
            <ShieldCheck className="w-5 h-5 text-white" aria-hidden="true" />
            <div className="text-left">
              <div className="font-semibold text-sm text-white">Trust Lens Verified</div>
              <div className="text-xs text-white/70">Every listing goes through our verification process</div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* CATEGORIES                                                    */}
      {/* ============================================================ */}
      <section
        aria-labelledby="categories-heading"
        className="max-w-5xl mx-auto px-4 py-14 md:py-16"
      >
        <h2
          id="categories-heading"
          className="text-2xl md:text-3xl font-bold text-[var(--color-text)] text-center mb-8"
        >
          Shop by Category
        </h2>

        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.name}
              href={cat.href}
              className="group flex flex-col items-center gap-3 bg-white rounded-xl p-5 border border-[var(--color-border)] hover:border-[var(--color-green)] hover:shadow-md transition-all"
            >
              <div className="w-14 h-14 rounded-xl bg-[var(--color-surface-alt)] group-hover:bg-[var(--color-green)]/10 flex items-center justify-center transition-colors text-3xl">
                {cat.emoji}
              </div>
              <span className="font-semibold text-sm text-[var(--color-text)] text-center">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ============================================================ */}
      {/* VERIFIED LISTINGS                                             */}
      {/* ============================================================ */}
      <section
        aria-labelledby="listings-heading"
        className="max-w-5xl mx-auto px-4 pb-14 md:pb-16"
      >
        <div className="flex items-center justify-between mb-6">
          <h2
            id="listings-heading"
            className="text-xl md:text-2xl font-bold text-[var(--color-text)]"
          >
            Verified Listings
          </h2>
          <Link
            href="/browse"
            className="inline-flex items-center gap-1 text-[var(--color-green)] hover:text-[var(--color-green-dark)] font-semibold text-sm transition-colors"
          >
            View All
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        className="bg-[var(--color-surface-alt)] py-14 md:py-16"
      >
        <div className="max-w-5xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2
              id="trust-lens-heading"
              className="text-2xl md:text-3xl font-bold text-[var(--color-text)]"
            >
              How Trust Lens Works
            </h2>
            <p className="text-[var(--color-text-muted)] mt-2 text-sm md:text-base">
              Every device goes through 4 simple verification steps
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {verificationSteps.map((step) => (
              <div
                key={step.step}
                className="bg-white rounded-2xl p-6 border border-[var(--color-border)] text-center hover:shadow-md transition-shadow"
              >
                <div className="text-5xl mb-4" aria-hidden="true">{step.emoji}</div>
                <div className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wide mb-1">
                  {step.step}
                </div>
                <div className="font-bold text-sm text-[var(--color-text)] mb-1">
                  {step.title}
                </div>
                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* CTA (unauthenticated only)                                    */}
      {/* ============================================================ */}
      {!user && (
        <section
          aria-labelledby="cta-heading"
          className="bg-[var(--color-primary)] py-14 md:py-16 text-center text-white"
        >
          <div className="max-w-2xl mx-auto px-4">
            <h2
              id="cta-heading"
              className="text-2xl md:text-3xl font-bold mb-3"
            >
              Ready to buy or sell with confidence?
            </h2>
            <p className="text-white/75 text-base mb-8">
              Join thousands of buyers and sellers who trust VeriBuy.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-dark)] text-[var(--color-primary-dark)] px-8 py-3.5 rounded-lg font-bold text-base transition-colors shadow-md"
              >
                Get Started Free
              </Link>
              <Link
                href="/how-it-works"
                className="border border-white/40 hover:border-white text-white px-8 py-3.5 rounded-lg font-semibold text-base transition-colors"
              >
                How It Works
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';

const categories = [
  { name: 'Phones', href: '/browse?category=smartphones', icon: '📱' },
  { name: 'Tablets', href: '/browse?category=tablets', icon: '📟' },
  { name: 'Laptops', href: '/browse?category=laptops', icon: '💻' },
  { name: 'Watches', href: '/browse?category=smartwatches', icon: '⌚' },
  { name: 'Gaming', href: '/browse?category=gaming', icon: '🎮' },
  { name: 'More', href: '/browse', icon: '✨' },
];

const trustSteps = [
  { 
    step: '1', 
    title: 'Seller Verified', 
    description: 'Identity checked before listing',
    icon: '✓'
  },
  { 
    step: '2', 
    title: 'Device Checked', 
    description: 'IMEI & serial validated',
    icon: '🔍'
  },
  { 
    step: '3', 
    title: 'Photos Captured', 
    description: 'Timestamped evidence stored',
    icon: '📸'
  },
  { 
    step: '4', 
    title: 'Grade Assigned', 
    description: 'Condition rated A/B/C',
    icon: '⭐'
  },
];

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      {/* Hero - Simplified and friendly */}
      <section aria-labelledby="hero-heading" className="bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] text-white py-12 md:py-20">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <h1 id="hero-heading" className="text-3xl md:text-5xl lg:text-6xl font-bold leading-tight mb-4 md:mb-6">
              Buy & Sell Electronics
              <span className="block text-[var(--color-warm-beige)] mt-2">You Can Trust</span>
            </h1>
            <p className="text-base md:text-xl text-white/90 mb-8 md:mb-10 max-w-2xl mx-auto leading-relaxed">
              Every device verified before it goes live. No fakes, no surprises, just honest deals.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/browse"
                className="bg-white text-[var(--color-primary)] hover:bg-[var(--color-warm-beige)] px-8 py-4 rounded-xl font-semibold text-lg transition-all shadow-lg hover:shadow-xl"
              >
                Browse Devices
              </Link>
              <Link
                href="/sell"
                className="border-2 border-white text-white hover:bg-white hover:text-[var(--color-primary)] px-8 py-4 rounded-xl font-semibold text-lg transition-all"
              >
                Start Selling
              </Link>
            </div>
          </div>

          {/* Trust badge - simplified */}
          <div className="mt-12 md:mt-16 max-w-md mx-auto">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-white/20">
              <div className="text-4xl md:text-5xl mb-3" aria-hidden="true">🛡️</div>
              <h2 className="text-xl md:text-2xl font-bold mb-2">Trust Lens Verified</h2>
              <p className="text-sm md:text-base text-white/80">
                Every listing goes through our verification process
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories - Simplified */}
      <section aria-labelledby="categories-heading" className="max-w-6xl mx-auto px-4 py-12 md:py-16">
        <h2 id="categories-heading" className="text-2xl md:text-3xl font-bold mb-6 md:mb-8 text-[var(--color-text)] text-center">
          Shop by Category
        </h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-4">
          {categories.map((cat) => (
            <Link
              key={cat.name}
              href={cat.href}
              className="bg-white hover:bg-[var(--color-primary-light)] hover:shadow-lg rounded-2xl p-4 md:p-6 text-center transition-all border-2 border-[var(--color-border)] hover:border-[var(--color-primary)] group"
            >
              <div className="text-3xl md:text-4xl mb-2 md:mb-3" aria-hidden="true">{cat.icon}</div>
              <div className="font-semibold text-xs md:text-sm text-[var(--color-text)] group-hover:text-white">
                {cat.name}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured Listings - Simplified */}
      <section aria-labelledby="listings-heading" className="bg-[var(--color-surface-alt)] py-12 md:py-16">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between items-center mb-6 md:mb-8">
            <h2 id="listings-heading" className="text-2xl md:text-3xl font-bold text-[var(--color-text)]">
              Verified Listings
            </h2>
            <Link 
              href="/browse" 
              className="text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] font-semibold text-sm md:text-base"
              aria-label="View all listings"
            >
              View All <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            <Link href="/browse?category=smartphones" className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow group">
              <div className="relative h-36 md:h-48 bg-gray-100">
                <Image
                  src="/images/products/iphone-14-pro.jpg"
                  alt="iPhone 14 Pro 256GB in space black, excellent condition"
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover"
                />
              </div>
              <div className="p-3 md:p-4">
                <div className="flex items-center gap-1.5 md:gap-2 mb-2">
                  <span className="bg-[var(--color-accent)] text-white text-xs px-2 py-0.5 rounded-full font-medium">
                    ✓ Verified
                  </span>
                  <span className="bg-[var(--color-primary)] text-white text-xs px-2 py-0.5 rounded-full font-medium">
                    A
                  </span>
                </div>
                <h3 className="font-semibold text-sm md:text-base mb-1 text-[var(--color-text)]">
                  iPhone 14 Pro 256GB
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-2">
                  Excellent condition
                </p>
                <p className="text-lg md:text-xl font-bold text-[var(--color-primary)]">
                  £899
                </p>
              </div>
            </Link>
            
            <Link href="/browse?category=smartphones" className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow group">
              <div className="relative h-36 md:h-48 bg-gray-100">
                <Image
                  src="/images/products/samsung-galaxy-s23.jpg"
                  alt="Samsung Galaxy S23 Ultra 512GB in phantom black, good condition"
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover"
                />
              </div>
              <div className="p-3 md:p-4">
                <div className="flex items-center gap-1.5 md:gap-2 mb-2">
                  <span className="bg-[var(--color-accent)] text-white text-xs px-2 py-0.5 rounded-full font-medium">
                    ✓ Verified
                  </span>
                  <span className="bg-[var(--color-primary)] text-white text-xs px-2 py-0.5 rounded-full font-medium">
                    B
                  </span>
                </div>
                <h3 className="font-semibold text-sm md:text-base mb-1 text-[var(--color-text)]">
                  Galaxy S23 Ultra 512GB
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-2">
                  Good condition
                </p>
                <p className="text-lg md:text-xl font-bold text-[var(--color-primary)]">
                  £749
                </p>
              </div>
            </Link>
            
            <Link href="/browse?category=laptops" className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow group">
              <div className="relative h-36 md:h-48 bg-gray-100">
                <Image
                  src="/images/products/macbook-pro.jpg"
                  alt="MacBook Pro 14-inch M2 chip, like new condition"
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover"
                />
              </div>
              <div className="p-3 md:p-4">
                <div className="flex items-center gap-1.5 md:gap-2 mb-2">
                  <span className="bg-[var(--color-accent)] text-white text-xs px-2 py-0.5 rounded-full font-medium">
                    ✓ Verified
                  </span>
                  <span className="bg-[var(--color-primary)] text-white text-xs px-2 py-0.5 rounded-full font-medium">
                    A
                  </span>
                </div>
                <h3 className="font-semibold text-sm md:text-base mb-1 text-[var(--color-text)]">
                  MacBook Pro 14" M2
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-2">
                  Like new
                </p>
                <p className="text-lg md:text-xl font-bold text-[var(--color-primary)]">
                  £1,699
                </p>
              </div>
            </Link>
            
            <Link href="/browse?category=tablets" className="bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-lg transition-shadow group">
              <div className="relative h-36 md:h-48 bg-gray-100">
                <Image
                  src="/images/products/ipad-air.jpg"
                  alt="iPad Air 5th generation 256GB in blue, excellent condition"
                  fill
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover"
                />
              </div>
              <div className="p-3 md:p-4">
                <div className="flex items-center gap-1.5 md:gap-2 mb-2">
                  <span className="bg-[var(--color-accent)] text-white text-xs px-2 py-0.5 rounded-full font-medium">
                    ✓ Verified
                  </span>
                  <span className="bg-[var(--color-primary)] text-white text-xs px-2 py-0.5 rounded-full font-medium">
                    A
                  </span>
                </div>
                <h3 className="font-semibold text-sm md:text-base mb-1 text-[var(--color-text)]">
                  iPad Air 5th Gen 256GB
                </h3>
                <p className="text-xs text-[var(--color-text-muted)] mb-2">
                  Excellent condition
                </p>
                <p className="text-lg md:text-xl font-bold text-[var(--color-primary)]">
                  £549
                </p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* How Trust Lens Works - Simplified */}
      <section aria-labelledby="trust-heading" className="max-w-6xl mx-auto px-4 py-12 md:py-20">
        <div className="text-center mb-10 md:mb-14">
          <h2 id="trust-heading" className="text-2xl md:text-4xl font-bold mb-3 md:mb-4 text-[var(--color-text)]">
            How Trust Lens Works
          </h2>
          <p className="text-base md:text-lg text-[var(--color-text-muted)] max-w-2xl mx-auto">
            Every device goes through 4 simple verification steps
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {trustSteps.map((s) => (
            <div key={s.step} className="text-center bg-white rounded-2xl p-6 md:p-8 shadow-sm hover:shadow-md transition-shadow border border-[var(--color-border)]">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-dark)] text-white rounded-2xl flex items-center justify-center text-3xl md:text-4xl mx-auto mb-4 shadow-md" aria-hidden="true">
                {s.icon}
              </div>
              <h3 className="font-bold text-base md:text-lg mb-2 text-[var(--color-text)]">
                {s.title}
              </h3>
              <p className="text-sm md:text-base text-[var(--color-text-muted)] leading-relaxed">
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA - Simplified */}
      {!user && (
        <section aria-labelledby="cta-heading" className="bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-dark)] py-12 md:py-16 text-center text-white">
          <div className="max-w-3xl mx-auto px-4">
            <h2 id="cta-heading" className="text-2xl md:text-4xl font-bold mb-3 md:mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-base md:text-xl mb-8 md:mb-10 text-white/90 leading-relaxed">
              Join thousands buying and selling verified electronics
            </p>
            <Link
              href="/register"
              className="bg-white text-[var(--color-accent-dark)] hover:bg-[var(--color-warm-beige)] px-10 py-4 rounded-xl font-bold text-lg transition-all inline-block shadow-lg hover:shadow-xl"
            >
              Create Free Account
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

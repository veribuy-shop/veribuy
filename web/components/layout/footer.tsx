import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-[var(--color-text)] text-white" aria-label="Site footer">
      {/* Main footer content */}
      <div className="max-w-6xl mx-auto px-4 py-10 md:py-12">
        {/* Responsive grid: 1 col mobile → 2 cols tablet → 4 cols desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10">
          {/* Brand */}
          <div className="text-center md:text-left">
            <h3 className="font-bold text-xl md:text-2xl text-[var(--color-primary)] mb-3">
              VeriBuy
            </h3>
            <p className="text-sm md:text-base text-[var(--color-warm-tan)] leading-relaxed">
              Trusted marketplace for verified electronics.
            </p>
          </div>

          {/* Buy */}
          <div className="text-center md:text-left">
            <h4 className="font-semibold text-base mb-3 md:mb-4">Buy</h4>
            <ul className="space-y-2 text-sm text-[var(--color-warm-tan)]">
              <li>
                <Link href="/browse" className="hover:text-[var(--color-primary-light)] transition-colors inline-block">
                  Browse Devices
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="hover:text-[var(--color-primary-light)] transition-colors inline-block">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/buyer-protection" className="hover:text-[var(--color-primary-light)] transition-colors inline-block">
                  Buyer Protection
                </Link>
              </li>
            </ul>
          </div>

          {/* Sell */}
          <div className="text-center md:text-left">
            <h4 className="font-semibold text-base mb-3 md:mb-4">Sell</h4>
            <ul className="space-y-2 text-sm text-[var(--color-warm-tan)]">
              <li>
                <Link href="/sell" className="hover:text-[var(--color-primary-light)] transition-colors inline-block">
                  Start Selling
                </Link>
              </li>
              <li>
                <Link href="/seller-verification" className="hover:text-[var(--color-primary-light)] transition-colors inline-block">
                  Get Verified
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-[var(--color-primary-light)] transition-colors inline-block">
                  Fees & Pricing
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div className="text-center md:text-left">
            <h4 className="font-semibold text-base mb-3 md:mb-4">Support</h4>
            <ul className="space-y-2 text-sm text-[var(--color-warm-tan)]">
              <li>
                <Link href="/help" className="hover:text-[var(--color-primary-light)] transition-colors inline-block">
                  Help Centre
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-[var(--color-primary-light)] transition-colors inline-block">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-[var(--color-primary-light)] transition-colors inline-block">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-[var(--color-primary-light)] transition-colors inline-block">
                  Privacy
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Copyright - simplified */}
      <div className="border-t border-[var(--color-warm-brown)] py-4 md:py-5 text-center">
        <p className="text-xs md:text-sm text-[var(--color-text-muted)]">
          &copy; {new Date().getFullYear()} VeriBuy. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

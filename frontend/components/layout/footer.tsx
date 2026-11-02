import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';
import { CookieSettingsButton } from '@/components/analytics-consent';

export function Footer() {
  return (
    <footer className="bg-[var(--color-primary)] text-white" aria-label="Site footer">
      <div className="max-w-5xl mx-auto px-4 py-10 md:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-center sm:text-left">
          {/* Brand */}
          <div className="flex flex-col items-center sm:items-start">
            <Link href="/" aria-label="VeriBuy home" className="inline-block rounded bg-white p-1 mb-3">
              <BrandLogo className="h-20 w-auto" />
            </Link>
            <p className="text-sm text-white/60 leading-relaxed max-w-xs sm:max-w-none">
              Trusted marketplace for verified electronics.
            </p>
          </div>

          {/* Buy */}
          <div className="flex flex-col items-center sm:items-start">
            <h4 className="font-semibold text-sm text-white mb-3">Buy</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><Link href="/browse" className="hover:text-white transition-colors">Browse Devices</Link></li>
              <li><Link href="/how-it-works" className="hover:text-white transition-colors">How It Works</Link></li>
              <li><Link href="/buyer-protection" className="hover:text-white transition-colors">Buyer Protection</Link></li>
            </ul>
          </div>

          {/* Sell */}
          <div className="flex flex-col items-center sm:items-start">
            <h4 className="font-semibold text-sm text-white mb-3">Sell</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><Link href="/sell" className="hover:text-white transition-colors">Start Selling</Link></li>
              <li><Link href="/seller-verification" className="hover:text-white transition-colors">How Verification Works</Link></li>
              <li><Link href="/pricing" className="hover:text-white transition-colors">Fees &amp; Pricing</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div className="flex flex-col items-center sm:items-start">
            <h4 className="font-semibold text-sm text-white mb-3">Support</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><Link href="/help" className="hover:text-white transition-colors">Help Centre</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms &amp; Conditions</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/cookies" className="hover:text-white transition-colors">Cookie Policy</Link></li>
              <li><CookieSettingsButton className="hover:text-white transition-colors" /></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 py-5 text-center px-4">
        <p className="text-xs text-white/40">
          &copy; {new Date().getFullYear()} VeriBuy LTD. All rights reserved.
        </p>
        <p className="text-xs text-white/40 mt-1">
          Registered in England &amp; Wales, Company No. 17391481. ICO registration ZC226120.
          {' '}Bartle House, 9 Oxford Court, Manchester, M2 3WQ.{' '}
          <a href="tel:03338809869" className="hover:text-white transition-colors">0333 880 9869</a>
        </p>
      </div>
    </footer>
  );
}

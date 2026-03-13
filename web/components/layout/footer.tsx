import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-[var(--color-primary)] text-white" aria-label="Site footer">
      <div className="max-w-5xl mx-auto px-4 py-10 md:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <h3 className="font-extrabold text-xl text-white mb-2 tracking-tight">
              VeriBuy
            </h3>
            <p className="text-sm text-white/60 leading-relaxed">
              Trusted marketplace for verified electronics.
            </p>
          </div>

          {/* Buy */}
          <div>
            <h4 className="font-semibold text-sm text-white mb-3">Buy</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><Link href="/browse" className="hover:text-white transition-colors">Browse Devices</Link></li>
              <li><Link href="/how-it-works" className="hover:text-white transition-colors">How It Works</Link></li>
              <li><Link href="/buyer-protection" className="hover:text-white transition-colors">Buyer Protection</Link></li>
            </ul>
          </div>

          {/* Sell */}
          <div>
            <h4 className="font-semibold text-sm text-white mb-3">Sell</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><Link href="/sell" className="hover:text-white transition-colors">Start Selling</Link></li>
              <li><Link href="/seller-verification" className="hover:text-white transition-colors">Get Verified</Link></li>
              <li><Link href="/pricing" className="hover:text-white transition-colors">Fees &amp; Pricing</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold text-sm text-white mb-3">Support</h4>
            <ul className="space-y-2 text-sm text-white/60">
              <li><Link href="/help" className="hover:text-white transition-colors">Help Centre</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact Us</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms</Link></li>
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 py-4 text-center">
        <p className="text-xs text-white/40">
          &copy; {new Date().getFullYear()} VeriBuy. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Seller Verification - VeriBuy',
};

export default function SellerVerificationPage() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <div className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] text-white py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="text-5xl mb-4">✓</div>
          <h1 className="text-3xl md:text-5xl font-bold mb-4">Get Verified to Sell</h1>
          <p className="text-lg md:text-xl text-white/90">
            Quick and easy verification process
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-[var(--color-border)]">
            <h2 className="text-xl font-bold text-[var(--color-text)] mb-3">What You'll Need</h2>
            <ul className="space-y-2 text-[var(--color-text-muted)]">
              <li className="flex items-start gap-3">
                <span className="text-[var(--color-accent)]">✓</span>
                Government-issued ID (driver's license, passport)
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--color-accent)]">✓</span>
                Valid email address
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--color-accent)]">✓</span>
                Phone number for verification
              </li>
              <li className="flex items-start gap-3">
                <span className="text-[var(--color-accent)]">✓</span>
                Bank account details for payouts
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-[var(--color-border)]">
            <h2 className="text-xl font-bold text-[var(--color-text)] mb-3">Verification Steps</h2>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-[var(--color-accent)] text-white rounded-full flex items-center justify-center font-bold text-sm">1</div>
                <div>
                  <h4 className="font-semibold text-[var(--color-text)]">Upload ID</h4>
                  <p className="text-sm text-[var(--color-text-muted)]">Take a photo of your government ID</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-[var(--color-accent)] text-white rounded-full flex items-center justify-center font-bold text-sm">2</div>
                <div>
                  <h4 className="font-semibold text-[var(--color-text)]">Verify Contact</h4>
                  <p className="text-sm text-[var(--color-text-muted)]">Confirm email and phone number</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-[var(--color-accent)] text-white rounded-full flex items-center justify-center font-bold text-sm">3</div>
                <div>
                  <h4 className="font-semibold text-[var(--color-text)]">Add Payment</h4>
                  <p className="text-sm text-[var(--color-text-muted)]">Link your bank account for payouts</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-8 h-8 bg-[var(--color-accent)] text-white rounded-full flex items-center justify-center font-bold text-sm">4</div>
                <div>
                  <h4 className="font-semibold text-[var(--color-text)]">Start Listing</h4>
                  <p className="text-sm text-[var(--color-text-muted)]">You're verified! Begin listing devices</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[var(--color-surface-alt)] rounded-2xl p-6 md:p-8 text-center">
            <p className="text-[var(--color-text-muted)] mb-4">
              Verification typically takes 10-15 minutes
            </p>
            <a
              href="/register"
              className="inline-block bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Get Started
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service - VeriBuy',
  description: 'VeriBuy Terms of Service',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-text)] mb-8">
          Terms of Service
        </h1>
        
        <div className="prose prose-lg max-w-none space-y-6 text-[var(--color-text-muted)]">
          <p className="text-sm text-[var(--color-text-muted)]">
            Last updated: February 24, 2026
          </p>

          <section>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing and using VeriBuy, you accept and agree to be bound by these Terms of Service. 
              If you do not agree to these terms, please do not use our platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">2. User Accounts</h2>
            <p>
              To buy or sell on VeriBuy, you must create an account. You are responsible for:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Providing accurate and complete information</li>
              <li>Maintaining the security of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Notifying us immediately of any unauthorized use</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">3. Trust Lens Verification</h2>
            <p>
              All sellers must complete Trust Lens verification before listing devices. By submitting a device for verification, you confirm that:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You are the legal owner of the device</li>
              <li>The device is not stolen, blacklisted, or subject to any liens</li>
              <li>All information provided is accurate and truthful</li>
              <li>You consent to device authentication checks</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">4. Fees and Payments</h2>
            <p>
              VeriBuy charges a 5% commission on successful sales. Payment processing fees may apply. 
              All fees are clearly displayed before completing a transaction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">5. Buyer Protection</h2>
            <p>
              Buyers may return devices within 7 days if they do not match the listing description. 
              Return shipping costs are the responsibility of the seller in case of misdescription.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">6. Prohibited Activities</h2>
            <p>You may not:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>List stolen, counterfeit, or blacklisted devices</li>
              <li>Misrepresent device condition or specifications</li>
              <li>Circumvent the Trust Lens verification process</li>
              <li>Engage in fraudulent or deceptive practices</li>
              <li>Harass or abuse other users</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">7. Intellectual Property</h2>
            <p>
              All content on VeriBuy, including logos, design, and software, is the property of VeriBuy 
              and protected by copyright and trademark laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">8. Limitation of Liability</h2>
            <p>
              VeriBuy acts as a marketplace platform. We are not responsible for the actions of buyers 
              or sellers. While we verify devices through Trust Lens, we make no warranties about device 
              functionality beyond what is stated in the listing.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">9. Modifications</h2>
            <p>
              We reserve the right to modify these terms at any time. Changes will be posted on this page 
              with an updated revision date. Continued use of the platform constitutes acceptance of modified terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">10. Contact</h2>
            <p>
              For questions about these Terms of Service, contact us at{' '}
              <a href="mailto:legal@veribuy.com" className="text-[var(--color-green)] hover:text-[var(--color-green-dark)] font-medium">
                legal@veribuy.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

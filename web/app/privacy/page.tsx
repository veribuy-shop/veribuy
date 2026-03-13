import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy - VeriBuy',
  description: 'VeriBuy Privacy Policy',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-text)] mb-8">
          Privacy Policy
        </h1>
        
        <div className="prose prose-lg max-w-none space-y-6 text-[var(--color-text-muted)]">
          <p className="text-sm text-[var(--color-text-muted)]">
            Last updated: February 24, 2026
          </p>

          <section>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">1. Information We Collect</h2>
            <p>We collect information to provide and improve our services:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Account Information:</strong> Name, email, phone number, and shipping address</li>
              <li><strong>Verification Data:</strong> Government ID for seller verification</li>
              <li><strong>Device Information:</strong> IMEI, serial numbers, photos, and condition details</li>
              <li><strong>Payment Information:</strong> Credit card details (processed securely by our payment provider)</li>
              <li><strong>Usage Data:</strong> How you interact with our platform, including browsing history</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">2. How We Use Your Information</h2>
            <p>We use collected information to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Operate and improve the VeriBuy platform</li>
              <li>Verify seller identity and device authenticity</li>
              <li>Process transactions and payments</li>
              <li>Communicate about orders, listings, and account activity</li>
              <li>Prevent fraud and enforce our Terms of Service</li>
              <li>Send marketing communications (with your consent)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">3. Information Sharing</h2>
            <p>We share your information only in limited circumstances:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>With Other Users:</strong> Buyers and sellers see necessary information to complete transactions</li>
              <li><strong>Service Providers:</strong> Payment processors, ID verification services, and cloud storage providers</li>
              <li><strong>Legal Compliance:</strong> When required by law or to protect our rights</li>
              <li><strong>Business Transfers:</strong> In case of merger, acquisition, or sale of assets</li>
            </ul>
            <p className="mt-4">We never sell your personal information to third parties.</p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">4. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your data, including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Encryption of sensitive data in transit and at rest</li>
              <li>Regular security audits and penetration testing</li>
              <li>Access controls and authentication requirements</li>
              <li>Secure cloud infrastructure with regular backups</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">5. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate information</li>
              <li>Request deletion of your account and data</li>
              <li>Opt out of marketing communications</li>
              <li>Export your data in a portable format</li>
            </ul>
            <p className="mt-4">
              To exercise these rights, contact us at{' '}
              <a href="mailto:privacy@veribuy.com" className="text-[var(--color-green)] hover:text-[var(--color-green-dark)] font-medium">
                privacy@veribuy.com
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">6. Cookies</h2>
            <p>
              We use only strictly necessary cookies required for authentication. No analytics,
              tracking, or personalisation cookies are used.
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-3">
              <li>
                <strong>accessToken</strong> — stores your session credentials so you remain logged
                in. Expires after 15 minutes. HttpOnly, SameSite=Strict.
              </li>
              <li>
                <strong>refreshToken</strong> — used to silently renew your session without
                requiring you to log in again. Expires after 7 days. HttpOnly, SameSite=Strict.
              </li>
            </ul>
            <p className="mt-3">
              Because these cookies are strictly necessary for the service to function, they do not
              require your consent under applicable cookie regulations (PECR / ePrivacy Directive).
              You can delete them at any time via your browser settings, which will log you out.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">7. Data Retention</h2>
            <p>
              We retain your information for as long as your account is active or as needed to provide services. 
              After account deletion, we may retain certain data for legal compliance and fraud prevention.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">8. Children's Privacy</h2>
            <p>
              VeriBuy is not intended for users under 18 years of age. We do not knowingly collect 
              information from children. If we become aware of such data, we will delete it promptly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy periodically. Changes will be posted on this page with 
              an updated revision date. We encourage you to review this policy regularly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">10. Contact Us</h2>
            <p>
              For privacy-related questions or concerns, contact us at{' '}
              <a href="mailto:privacy@veribuy.com" className="text-[var(--color-green)] hover:text-[var(--color-green-dark)] font-medium">
                privacy@veribuy.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

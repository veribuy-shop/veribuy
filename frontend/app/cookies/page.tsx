import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Cookie Policy',
  description: 'VeriBuy Cookie Policy - how essential cookies are used to keep accounts secure.',
  alternates: {
    canonical: '/cookies',
  },
};

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
        <h1 className="text-3xl md:text-4xl font-bold text-[var(--color-text)] mb-8">
          Cookie Policy
        </h1>

        <div className="prose prose-lg max-w-none space-y-6 text-[var(--color-text-muted)]">
          <p className="text-sm">Last updated: August 27, 2026</p>

          <section>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">1. About This Policy</h2>
            <p>
              This policy explains how VeriBuy uses cookies and similar browser storage when you use
              our website. It should be read with our <Link href="/privacy" className="text-[var(--color-green)] font-medium hover:text-[var(--color-green-dark)]">Privacy Policy</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">2. Cookies We Use</h2>
            <p>VeriBuy currently uses only cookies that are strictly necessary to provide and secure the service.</p>
            <div className="overflow-x-auto mt-4">
              <table className="w-full border-collapse text-left text-base">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[var(--color-text)]">
                    <th className="py-3 pr-4">Cookie</th>
                    <th className="py-3 pr-4">Purpose</th>
                    <th className="py-3">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[var(--color-border)]">
                    <td className="py-3 pr-4 font-medium text-[var(--color-text)]">accessToken</td>
                    <td className="py-3 pr-4">Authenticates requests while you are signed in.</td>
                    <td className="py-3">15 minutes</td>
                  </tr>
                  <tr className="border-b border-[var(--color-border)]">
                    <td className="py-3 pr-4 font-medium text-[var(--color-text)]">refreshToken</td>
                    <td className="py-3 pr-4">Renews your session without requiring another login.</td>
                    <td className="py-3">7 days</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">3. Analytics and Advertising</h2>
            <p>
              We do not currently use analytics, advertising, tracking, or personalisation cookies.
              If that changes, we will update this policy and request consent where required before
              placing non-essential cookies.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">4. Managing Cookies</h2>
            <p>
              You can block or delete cookies using your browser settings. Blocking VeriBuy&apos;s
              essential cookies will prevent sign-in and other account features from working. Deleting
              them will sign you out of your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">5. Changes and Contact</h2>
            <p>
              We may update this policy when our use of cookies changes. Questions can be sent to{' '}
              <a href="mailto:support@veribuy.shop" className="text-[var(--color-green)] font-medium hover:text-[var(--color-green-dark)]">
                support@veribuy.shop
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

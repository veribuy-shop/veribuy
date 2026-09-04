import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalHeader } from '@/components/legal-nav';
import { Cookie, ShieldCheck, CheckCircle2, Lock, Settings2, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Cookie Policy & Local Storage',
  description: 'VeriBuy Cookie Policy - explanation of essential authentication cookies and our strict no-ad-tracking privacy policy.',
  alternates: {
    canonical: '/cookies',
  },
};

const TOC = [
  { id: 'what-are-cookies', label: '1. What Are Cookies?' },
  { id: 'cookies-we-use', label: '2. Cookies & Storage We Use' },
  { id: 'no-tracking', label: '3. No Ad Tracking or Profiling' },
  { id: 'managing-cookies', label: '4. How to Control & Manage Cookies' },
  { id: 'contact', label: '5. Questions & Updates' },
];

export default function CookiePolicyPage() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <LegalHeader
        title="Cookie Policy"
        subtitle="Transparent information on how VeriBuy uses strictly necessary cookies and browser storage to keep your session secure without invasive tracking."
        lastUpdated="September 4, 2026"
        badge="Zero-Tracker Guarantee"
      />

      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sticky Table of Contents */}
          <aside className="hidden lg:block lg:col-span-1">
            <div className="sticky top-24 bg-white border border-[var(--color-border)] rounded-2xl p-5 shadow-sm space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                On this page
              </h2>
              <nav aria-label="Table of contents" className="space-y-1 text-xs">
                {TOC.map((item) => (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="block py-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-green)] hover:translate-x-0.5 transition-all font-medium"
                  >
                    {item.label}
                  </a>
                ))}
              </nav>

              <div className="pt-4 border-t border-[var(--color-border)]">
                <Link
                  href="/privacy"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-green)] hover:underline"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Read Full Privacy Policy <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-3 space-y-8">
            {/* Quick Principles Banner */}
            <div className="bg-white border border-[var(--color-border)] rounded-2xl p-6 shadow-sm">
              <h2 className="text-base font-bold text-[var(--color-text)] mb-3 flex items-center gap-2">
                <Cookie className="w-5 h-5 text-[var(--color-green)]" aria-hidden="true" />
                Our Cookie Transparency Promise
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-[var(--color-text-muted)]">
                <div className="p-3 bg-[var(--color-surface-alt)] rounded-xl border border-[var(--color-border)]/60">
                  <strong className="text-[var(--color-text)] block mb-1">Strictly Essential</strong>
                  We only set cookies required for secure login authentication, CSRF defense, and session persistence.
                </div>
                <div className="p-3 bg-[var(--color-surface-alt)] rounded-xl border border-[var(--color-border)]/60">
                  <strong className="text-[var(--color-text)] block mb-1">Zero Ad Trackers</strong>
                  No third-party marketing pixels (e.g. Meta Pixel, TikTok pixel) or behavioral ad cookies.
                </div>
                <div className="p-3 bg-[var(--color-surface-alt)] rounded-xl border border-[var(--color-border)]/60">
                  <strong className="text-[var(--color-text)] block mb-1">HttpOnly Security</strong>
                  Authentication tokens cannot be read by browser JavaScript, defending against cross-site scripting (XSS).
                </div>
              </div>
            </div>

            {/* Section 1 */}
            <section id="what-are-cookies" className="bg-white border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-bold text-[var(--color-text)] mb-3">1. What Are Cookies?</h2>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                Cookies are small text files stored on your computer or mobile device when you access websites. They allow web servers to recognize your device across multiple requests, keeping you signed in as you navigate between pages.
              </p>
            </section>

            {/* Section 2: Table */}
            <section id="cookies-we-use" className="bg-white border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-bold text-[var(--color-text)] mb-4">2. Cookies & Storage We Use</h2>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4">
                The following cookies and local storage keys are essential to the operation of the VeriBuy platform:
              </p>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-[var(--color-border)] rounded-xl overflow-hidden">
                  <thead className="bg-[var(--color-surface-alt)] text-[var(--color-text)] font-semibold border-b border-[var(--color-border)]">
                    <tr>
                      <th className="p-3">Cookie / Key</th>
                      <th className="p-3">Category</th>
                      <th className="p-3">Purpose & Description</th>
                      <th className="p-3">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]/50 text-[var(--color-text-muted)]">
                    <tr>
                      <td className="p-3 font-mono font-bold text-[var(--color-text)]">accessToken</td>
                      <td className="p-3 font-semibold text-[var(--color-green)]">Strictly Essential</td>
                      <td className="p-3">Cryptographic JWT token used to authenticate API requests while you are signed into your account.</td>
                      <td className="p-3">15 minutes</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-bold text-[var(--color-text)]">refreshToken</td>
                      <td className="p-3 font-semibold text-[var(--color-green)]">Strictly Essential</td>
                      <td className="p-3">Secure HttpOnly token used to issue a new access token without requiring you to re-enter your password.</td>
                      <td className="p-3">7 days</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-bold text-[var(--color-text)]">__stripe_mid / __stripe_sid</td>
                      <td className="p-3 font-semibold text-blue-600">Security & Anti-Fraud</td>
                      <td className="p-3">Embedded by Stripe to prevent payment fraud and detect fraudulent charge attempts during checkout.</td>
                      <td className="p-3">Session / 1 year</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 3 */}
            <section id="no-tracking" className="bg-white border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-bold text-[var(--color-text)] mb-3">3. No Advertising or Tracking Cookies</h2>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-3">
                VeriBuy takes user privacy seriously:
              </p>
              <ul className="space-y-2 text-sm text-[var(--color-text-muted)]">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--color-green)] shrink-0 mt-0.5" />
                  <span>We do not run third-party advertising tracking networks or behavioral ad targeting.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--color-green)] shrink-0 mt-0.5" />
                  <span>We do not sell user analytics or device search histories to third-party data brokers.</span>
                </li>
              </ul>
            </section>

            {/* Section 4 & 5 */}
            <section id="managing-cookies" className="bg-white border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              <div>
                <h2 className="text-xl font-bold text-[var(--color-text)] mb-3">4. How to Control & Manage Cookies</h2>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4">
                  Most modern web browsers allow you to control cookies through their settings preferences:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[var(--color-text-muted)]">
                  <div className="p-3.5 bg-[var(--color-surface-alt)] rounded-xl border border-[var(--color-border)]">
                    <strong className="text-[var(--color-text)] block mb-1">Google Chrome:</strong>
                    Settings → Privacy and security → Third-party cookies.
                  </div>
                  <div className="p-3.5 bg-[var(--color-surface-alt)] rounded-xl border border-[var(--color-border)]">
                    <strong className="text-[var(--color-text)] block mb-1">Apple Safari:</strong>
                    Preferences → Privacy → Prevent cross-site tracking.
                  </div>
                  <div className="p-3.5 bg-[var(--color-surface-alt)] rounded-xl border border-[var(--color-border)]">
                    <strong className="text-[var(--color-text)] block mb-1">Mozilla Firefox:</strong>
                    Settings → Privacy & Security → Enhanced Tracking Protection.
                  </div>
                  <div className="p-3.5 bg-[var(--color-surface-alt)] rounded-xl border border-[var(--color-border)]">
                    <strong className="text-[var(--color-text)] block mb-1">Microsoft Edge:</strong>
                    Settings → Cookies and site permissions → Manage and delete cookies.
                  </div>
                </div>
              </div>

              <div id="contact" className="pt-4 border-t border-[var(--color-border)]">
                <h2 className="text-xl font-bold text-[var(--color-text)] mb-3">5. Questions & Updates</h2>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                  If you have questions regarding our cookie implementation, please email{' '}
                  <a href="mailto:privacy@veribuy.shop" className="text-[var(--color-green)] font-semibold hover:underline">
                    privacy@veribuy.shop
                  </a>{' '}
                  or review our{' '}
                  <Link href="/privacy" className="text-[var(--color-green)] font-semibold hover:underline">
                    Privacy Policy
                  </Link>.
                </p>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

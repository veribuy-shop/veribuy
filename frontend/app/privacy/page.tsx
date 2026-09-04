import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalHeader } from '@/components/legal-nav';
import { Shield, Lock, Eye, UserCheck, Database, KeyRound, ArrowRight, CheckCircle2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy & Data Protection',
  description: 'VeriBuy Privacy Policy - UK GDPR and Data Protection Act 2018 compliance, personal information processing, and device data security.',
  alternates: {
    canonical: '/privacy',
  },
};

const TOC = [
  { id: 'overview', label: '1. Overview & Data Controller' },
  { id: 'collection', label: '2. Information We Collect' },
  { id: 'purposes', label: '3. How & Why We Use Your Data' },
  { id: 'sharing', label: '4. Third-Party Data Sharing' },
  { id: 'security', label: '5. Security & Encryption Standards' },
  { id: 'rights', label: '6. Your UK GDPR Rights' },
  { id: 'retention', label: '7. Data Retention & Deletion' },
  { id: 'contact', label: '8. Data Protection Officer' },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <LegalHeader
        title="Privacy Policy"
        subtitle="How VeriBuy collects, processes, secures, and protects your personal data and device verification records in compliance with UK GDPR."
        lastUpdated="September 4, 2026"
        badge="UK GDPR & DPA 2018 Compliant"
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
                  href="/cookies"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-green)] hover:underline"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View Cookie Policy <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-3 space-y-8">
            {/* Quick Principles Banner */}
            <div className="bg-white border border-[var(--color-border)] rounded-2xl p-6 shadow-sm">
              <h2 className="text-base font-bold text-[var(--color-text)] mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5 text-[var(--color-green)]" aria-hidden="true" />
                Our Privacy Commitments
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-[var(--color-text-muted)]">
                <div className="p-3 bg-[var(--color-surface-alt)] rounded-xl border border-[var(--color-border)]/60">
                  <strong className="text-[var(--color-text)] block mb-1">Zero Data Selling</strong>
                  We never sell, rent, or monetize your personal or transaction data with data brokers or ad networks.
                </div>
                <div className="p-3 bg-[var(--color-surface-alt)] rounded-xl border border-[var(--color-border)]/60">
                  <strong className="text-[var(--color-text)] block mb-1">Encrypted Identifiers</strong>
                  IMEI and serial numbers are encrypted and isolated exclusively for fraud prevention and Trust Lens checks.
                </div>
                <div className="p-3 bg-[var(--color-surface-alt)] rounded-xl border border-[var(--color-border)]/60">
                  <strong className="text-[var(--color-text)] block mb-1">Essential Cookies Only</strong>
                  We don&apos;t use invasive third-party ad trackers, cross-site beacons, or behavioral profiling cookies.
                </div>
              </div>
            </div>

            {/* Section 1 */}
            <section id="overview" className="bg-white border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-bold text-[var(--color-text)] mb-3">1. Overview & Data Controller</h2>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4">
                VeriBuy Ltd (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) is the Data Controller responsible for your personal data collected through <code className="bg-[var(--color-surface-alt)] px-1.5 py-0.5 rounded text-xs font-mono text-[var(--color-text)]">veribuy.shop</code> and associated API services under the UK General Data Protection Regulation (UK GDPR) and Data Protection Act 2018.
              </p>
            </section>

            {/* Section 2 */}
            <section id="collection" className="bg-white border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-bold text-[var(--color-text)] mb-4">2. Categories of Information We Collect</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-[var(--color-border)] rounded-xl overflow-hidden">
                  <thead className="bg-[var(--color-surface-alt)] text-[var(--color-text)] font-semibold border-b border-[var(--color-border)]">
                    <tr>
                      <th className="p-3">Data Category</th>
                      <th className="p-3">Specific Data Elements</th>
                      <th className="p-3">Lawful Basis (UK GDPR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]/50 text-[var(--color-text-muted)]">
                    <tr>
                      <td className="p-3 font-semibold text-[var(--color-text)]">Account & Profile</td>
                      <td className="p-3">Full name, email address, password hash, contact phone number.</td>
                      <td className="p-3">Contract performance (Art. 6(1)(b))</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-[var(--color-text)]">Device Identifiers</td>
                      <td className="p-3">IMEI (15-digit), Serial Number, evidence photos, battery metrics.</td>
                      <td className="p-3">Legitimate interests & fraud prevention (Art. 6(1)(f))</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-[var(--color-text)]">Order & Delivery</td>
                      <td className="p-3">Delivery address, Royal Mail tracking numbers, transaction timestamps.</td>
                      <td className="p-3">Contract performance (Art. 6(1)(b))</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold text-[var(--color-text)]">Payment Details</td>
                      <td className="p-3">Tokenised payment reference (processed strictly via Stripe; full card numbers are never stored on our servers).</td>
                      <td className="p-3">Legal obligation & Contract (Art. 6(1)(c))</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Section 3 & 4 */}
            <section id="purposes" className="bg-white border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              <div>
                <h2 className="text-xl font-bold text-[var(--color-text)] mb-3">3. How & Why We Use Your Data</h2>
                <ul className="space-y-2 text-sm text-[var(--color-text-muted)]">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[var(--color-green)] shrink-0 mt-0.5" />
                    <span><strong>Operating Trust Lens™:</strong> Conducting automated GSMA blacklist verification, stolen device cross-referencing, and cloud lock verification.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[var(--color-green)] shrink-0 mt-0.5" />
                    <span><strong>Escrow Transactions:</strong> Processing Stripe PaymentIntents and releasing funds after verified delivery and inspection.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[var(--color-green)] shrink-0 mt-0.5" />
                    <span><strong>Dispute Mediation:</strong> Inspecting timestamped device evidence packs to resolve condition discrepancies fairly.</span>
                  </li>
                </ul>
              </div>

              <div id="sharing" className="pt-4 border-t border-[var(--color-border)]">
                <h2 className="text-xl font-bold text-[var(--color-text)] mb-3">4. Third-Party Service Providers</h2>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-3">
                  We disclose data strictly to vetted service providers bound by Data Processing Agreements (DPAs):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[var(--color-text)]">
                  <div className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)]">
                    <strong>Stripe Payments UK</strong>
                    <p className="text-[var(--color-text-muted)] mt-1">PCI-DSS Level 1 payment processor for escrow handling.</p>
                  </div>
                  <div className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)]">
                    <strong>Cloudinary Media</strong>
                    <p className="text-[var(--color-text-muted)] mt-1">Encrypted storage for timestamped evidence photos.</p>
                  </div>
                  <div className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)]">
                    <strong>Royal Mail Logistics</strong>
                    <p className="text-[var(--color-text-muted)] mt-1">Tracked parcel dispatch & delivery confirmation.</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Section 5 & 6 */}
            <section id="security" className="bg-white border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              <div>
                <h2 className="text-xl font-bold text-[var(--color-text)] mb-3">5. Security & Encryption Standards</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[var(--color-text-muted)]">
                  <div className="p-3.5 bg-[var(--color-surface-alt)] rounded-xl border border-[var(--color-border)] flex items-start gap-2.5">
                    <Lock className="w-4 h-4 text-[var(--color-green)] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-[var(--color-text)] block mb-0.5">TLS 1.3 in Transit</strong>
                      All browser-to-server communications use modern cryptographic ciphers with strict HSTS.
                    </div>
                  </div>
                  <div className="p-3.5 bg-[var(--color-surface-alt)] rounded-xl border border-[var(--color-border)] flex items-start gap-2.5">
                    <KeyRound className="w-4 h-4 text-[var(--color-green)] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-[var(--color-text)] block mb-0.5">HttpOnly Session Cookies</strong>
                      Authentication tokens are stored in HttpOnly, SameSite=Strict cookies inaccessible to client scripts.
                    </div>
                  </div>
                </div>
              </div>

              <div id="rights" className="pt-4 border-t border-[var(--color-border)]">
                <h2 className="text-xl font-bold text-[var(--color-text)] mb-3">6. Your UK GDPR Rights</h2>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4">
                  Under UK data protection law, you have enforceable statutory rights regarding your personal data:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[var(--color-text-muted)]">
                  <div className="p-3 border border-[var(--color-border)] rounded-xl">
                    <strong className="text-[var(--color-text)] block mb-1">Right to Access:</strong>
                    Request a copy of all personal data we hold about you.
                  </div>
                  <div className="p-3 border border-[var(--color-border)] rounded-xl">
                    <strong className="text-[var(--color-text)] block mb-1">Right to Erasure:</strong>
                    Request deletion of your account and associated personal data.
                  </div>
                  <div className="p-3 border border-[var(--color-border)] rounded-xl">
                    <strong className="text-[var(--color-text)] block mb-1">Right to Rectification:</strong>
                    Correct any inaccurate or incomplete personal details.
                  </div>
                  <div className="p-3 border border-[var(--color-border)] rounded-xl">
                    <strong className="text-[var(--color-text)] block mb-1">Right to Data Portability:</strong>
                    Obtain your listing and order history in standard machine-readable JSON format.
                  </div>
                </div>
              </div>
            </section>

            {/* Section 7 & 8 */}
            <section id="retention" className="bg-white border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              <div>
                <h2 className="text-xl font-bold text-[var(--color-text)] mb-3">7. Data Retention Policy</h2>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                  We retain user profile data for as long as your account remains active. Transaction and VAT invoice records are retained for 6 years in accordance with UK statutory accounting obligations (HMRC requirements), after which they are permanently anonymised or destroyed.
                </p>
              </div>

              <div id="contact" className="pt-4 border-t border-[var(--color-border)]">
                <h2 className="text-xl font-bold text-[var(--color-text)] mb-3">8. Data Protection Officer & Contact</h2>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                  To exercise your privacy rights or submit a Data Subject Access Request (DSAR), please contact our Data Protection Officer at{' '}
                  <a href="mailto:dpo@veribuy.shop" className="text-[var(--color-green)] font-semibold hover:underline">
                    dpo@veribuy.shop
                  </a>. If you are unsatisfied with our response, you have the right to lodge a complaint with the UK Information Commissioner&apos;s Office (ICO) at <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-[var(--color-green)] font-semibold hover:underline">ico.org.uk</a>.
                </p>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

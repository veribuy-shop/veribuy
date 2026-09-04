import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalHeader } from '@/components/legal-nav';
import { ShieldCheck, Scale, CheckCircle2, AlertCircle, HelpCircle, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Terms and Conditions of Service',
  description: 'VeriBuy Terms and Conditions - rules, verification requirements, escrow protections, and fee policies for buying and selling verified electronics.',
  alternates: {
    canonical: '/terms',
  },
};

const TOC = [
  { id: 'acceptance', label: '1. Acceptance of Terms' },
  { id: 'accounts', label: '2. User Accounts & Eligibility' },
  { id: 'verification', label: '3. Trust Lens™ Device Verification' },
  { id: 'fees', label: '4. Fees, Pricing & Seller Payouts' },
  { id: 'escrow', label: '5. Escrow Payment & 7-Day Protection' },
  { id: 'prohibited', label: '6. Prohibited Items & Activities' },
  { id: 'ip', label: '7. Intellectual Property Rights' },
  { id: 'liability', label: '8. Limitation of Liability' },
  { id: 'modifications', label: '9. Changes & Governing Law' },
  { id: 'contact', label: '10. Contact Information' },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <LegalHeader
        title="Terms and Conditions"
        subtitle="The legal agreement governing your access to and use of the VeriBuy marketplace, Trust Lens™ verification service, and escrow payments."
        lastUpdated="September 4, 2026"
        badge="Contractual Terms"
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
                  href="/buyer-protection"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-green)] hover:underline"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Read Buyer Protection Guide <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </aside>

          {/* Main Legal Content */}
          <main className="lg:col-span-3 space-y-8">
            {/* Summary Highlights Card */}
            <div className="bg-white border border-[var(--color-border)] rounded-2xl p-6 shadow-sm">
              <h2 className="text-base font-bold text-[var(--color-text)] mb-3 flex items-center gap-2">
                <Scale className="w-5 h-5 text-[var(--color-green)]" aria-hidden="true" />
                Key Highlights & Platform Guarantees
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-[var(--color-text-muted)]">
                <div className="p-3 bg-[var(--color-surface-alt)] rounded-xl border border-[var(--color-border)]/60">
                  <strong className="text-[var(--color-text)] block mb-1">0% Seller Fees</strong>
                  Sellers keep 100% of their device sale price with £0 listing or transaction commissions.
                </div>
                <div className="p-3 bg-[var(--color-surface-alt)] rounded-xl border border-[var(--color-border)]/60">
                  <strong className="text-[var(--color-text)] block mb-1">100% Escrow Protection</strong>
                  Buyer payments remain securely held in escrow until the device is inspected and accepted.
                </div>
                <div className="p-3 bg-[var(--color-surface-alt)] rounded-xl border border-[var(--color-border)]/60">
                  <strong className="text-[var(--color-text)] block mb-1">Mandatory Trust Lens™</strong>
                  Every phone, tablet, and wearable is checked against GSMA blacklists before listings go live.
                </div>
              </div>
            </div>

            {/* Section 1 */}
            <section id="acceptance" className="bg-white border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-bold text-[var(--color-text)] mb-3">1. Acceptance of Terms</h2>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4">
                By creating an account, browsing listings, submitting a device for verification, or completing a transaction on VeriBuy (&ldquo;the Platform&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), you acknowledge that you have read, understood, and agreed to be legally bound by these Terms and Conditions and our Privacy Policy.
              </p>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                If you do not agree with any part of these Terms, you must immediately cease using the Platform.
              </p>
            </section>

            {/* Section 2 */}
            <section id="accounts" className="bg-white border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-bold text-[var(--color-text)] mb-3">2. User Accounts & Eligibility</h2>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4">
                To purchase or sell devices on VeriBuy, you must register an account and be at least 18 years of age with a valid UK shipping address.
              </p>
              <ul className="space-y-2 text-sm text-[var(--color-text-muted)]">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--color-green)] shrink-0 mt-0.5" />
                  <span>You agree to provide accurate, current, and complete registration information.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--color-green)] shrink-0 mt-0.5" />
                  <span>You are solely responsible for maintaining the confidentiality of your credentials.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--color-green)] shrink-0 mt-0.5" />
                  <span>Accounts cannot be transferred, leased, or assigned to third parties without prior written consent.</span>
                </li>
              </ul>
            </section>

            {/* Section 3 */}
            <section id="verification" className="bg-white border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-bold text-[var(--color-text)] mb-3">3. Trust Lens™ Device Verification</h2>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4">
                All consumer electronics listed on VeriBuy are subjected to Trust Lens™ verification prior to public publication. When submitting a device, sellers warrant and agree that:
              </p>
              <div className="space-y-3 text-sm text-[var(--color-text-muted)]">
                <div className="p-3.5 bg-[var(--color-surface-alt)] rounded-xl border border-[var(--color-border)]">
                  <strong className="text-[var(--color-text)] block mb-1">Ownership & Clear Title:</strong>
                  The seller is the lawful owner with unencumbered title. Devices under active carrier finance agreements without payout approval, company-enrolled MDM profiles, or disputed ownership are strictly prohibited.
                </div>
                <div className="p-3.5 bg-[var(--color-surface-alt)] rounded-xl border border-[var(--color-border)]">
                  <strong className="text-[var(--color-text)] block mb-1">Blacklist & Lock Checks:</strong>
                  IMEIs and Serial Numbers are screened against the GSMA international registry, police lost/stolen databases, and cloud lock mechanisms (Apple iCloud Activation Lock / Find My, Samsung Knox, Google FRP).
                </div>
              </div>
            </section>

            {/* Section 4 */}
            <section id="fees" className="bg-white border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-bold text-[var(--color-text)] mb-3">4. Fees, Pricing & Seller Payouts</h2>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4">
                VeriBuy operates with complete fee transparency:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mb-4">
                <div className="p-4 border border-[var(--color-border)] rounded-xl bg-white">
                  <span className="text-xs font-bold text-[var(--color-green)] uppercase tracking-wider block mb-1">Sellers</span>
                  <span className="text-2xl font-black text-[var(--color-text)] block mb-1">0% Commission</span>
                  <p className="text-[var(--color-text-muted)]">Sellers receive 100% of their item asking price. No listing fees, no insertion fees, and no percentage deductions upon sale.</p>
                </div>
                <div className="p-4 border border-[var(--color-border)] rounded-xl bg-white">
                  <span className="text-xs font-bold text-blue-600 uppercase tracking-wider block mb-1">Buyers</span>
                  <span className="text-2xl font-black text-[var(--color-text)] block mb-1">Buyer Protection Fee</span>
                  <p className="text-[var(--color-text-muted)]">A variable protection fee (clearly itemised at checkout) covers escrow handling, Trust Lens™ hardware verification, and 7-day money-back dispute guarantee.</p>
                </div>
              </div>
            </section>

            {/* Section 5 */}
            <section id="escrow" className="bg-white border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-bold text-[var(--color-text)] mb-3">5. Escrow Payment & 7-Day Protection</h2>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-4">
                Upon order confirmation, buyer payment is placed into secure escrow managed via Stripe. Escrow release follows this strict protocol:
              </p>
              <ol className="space-y-3 text-sm text-[var(--color-text-muted)] list-decimal pl-5">
                <li><strong>Dispatch Requirement:</strong> Sellers must dispatch within 3 working days via tracked Royal Mail delivery.</li>
                <li><strong>Inspection Window:</strong> Buyers receive a 7-day inspection window starting upon carrier delivery confirmation.</li>
                <li><strong>Release or Dispute:</strong> Funds are automatically released to the seller after the 7-day window expires unless the buyer opens a valid dispute for misrepresentation or undisclosed hardware defect.</li>
              </ol>
            </section>

            {/* Section 6 */}
            <section id="prohibited" className="bg-white border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 shadow-sm">
              <h2 className="text-xl font-bold text-[var(--color-text)] mb-3">6. Prohibited Items & Activities</h2>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed mb-3">
                Users may not engage in any of the following activities on VeriBuy:
              </p>
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-900 space-y-2">
                <div>• Listing counterfeit, stolen, blacklisted, or iCloud/Google FRP locked devices.</div>
                <div>• Circumventing or manipulating Trust Lens™ evidence or condition grading.</div>
                <div>• Soliciting off-platform payments (e.g. bank transfer, cash, external links).</div>
                <div>• Creating duplicate accounts to evade suspension or fee rules.</div>
              </div>
            </section>

            {/* Section 7 - 10 */}
            <section id="liability" className="bg-white border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
              <div>
                <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">7. Intellectual Property & Brand Rights</h2>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                  VeriBuy, Trust Lens™, and all proprietary software, UI designs, and verification algorithms are protected by UK and international intellectual property laws. Apple, Samsung, Google, and other brand names are the trademarks of their respective owners.
                </p>
              </div>

              <div id="liability" className="pt-4 border-t border-[var(--color-border)]">
                <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">8. Limitation of Liability</h2>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                  To the maximum extent permitted by UK law, VeriBuy provides the marketplace on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. While Trust Lens™ applies rigorous authentication and IMEI verification checks, VeriBuy is not liable for latent manufacturing defects or post-delivery device damage.
                </p>
              </div>

              <div id="modifications" className="pt-4 border-t border-[var(--color-border)]">
                <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">9. Governing Law & Jurisdiction</h2>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                  These Terms are governed by and construed in accordance with the laws of England and Wales. The courts of England and Wales have exclusive jurisdiction to settle any dispute or claim.
                </p>
              </div>

              <div id="contact" className="pt-4 border-t border-[var(--color-border)]">
                <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">10. Contact Information</h2>
                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                  For questions regarding these Terms or dispute mediation, reach our legal compliance team at{' '}
                  <a href="mailto:legal@veribuy.shop" className="text-[var(--color-green)] font-semibold hover:underline">
                    legal@veribuy.shop
                  </a>{' '}
                  or via our{' '}
                  <Link href="/contact" className="text-[var(--color-green)] font-semibold hover:underline">
                    Contact Support Page
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

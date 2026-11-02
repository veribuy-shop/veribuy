import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalHeader } from '@/components/legal-nav';
import { Shield, Eye, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy & Data Protection',
  description: 'How VeriBuy collects and uses personal data on its website and app, who it is shared with, and your rights under UK data protection law.',
  alternates: {
    canonical: '/privacy',
  },
};

const TOC = [
  { id: 'overview', label: '1. Who we are' },
  { id: 'collection', label: '2. Information we collect' },
  { id: 'purposes', label: '3. How we use your data' },
  { id: 'sharing', label: '4. Who we share it with' },
  { id: 'transfers', label: '5. International transfers' },
  { id: 'mobile-app', label: '6. Our mobile app' },
  { id: 'cookies', label: '7. Cookies & analytics' },
  { id: 'security', label: '8. Security' },
  { id: 'retention', label: '9. How long we keep data' },
  { id: 'rights', label: '10. Your rights' },
  { id: 'contact', label: '11. Contact & complaints' },
];

const SECTION = 'bg-white border border-[var(--color-border)] rounded-2xl p-6 sm:p-8 shadow-sm';
const HEADING = 'text-xl font-bold text-[var(--color-text)] mb-3';
const BODY = 'text-sm text-[var(--color-text-muted)] leading-relaxed';
const LIST = 'list-disc pl-5 space-y-2 text-sm text-[var(--color-text-muted)] leading-relaxed';

const DATA_CATEGORIES = [
  ['Account & profile', 'Name, email address, hashed password, phone number, address, and business details if you register as a business.', 'Contract'],
  ['Listings', 'Device details, IMEI and serial number, photos, condition, price and listing drafts.', 'Contract; legitimate interests (fraud prevention)'],
  ['Orders & delivery', 'Delivery address, Royal Mail tracking, order history and any disputes.', 'Contract; legal obligation'],
  ['Payments', 'A payment reference from Stripe. Card details go directly to Stripe and we never store them.', 'Contract; legal obligation'],
  ['Marketplace activity', 'Bids, offers, messages, ratings and referrals.', 'Contract'],
  ['Records of agreement', 'When you accepted our Terms and this policy, and which version.', 'Legal obligation; legitimate interests'],
  ['Technical', 'IP address and request information, used for security and rate limiting. Website usage data if you accept analytics.', 'Legitimate interests'],
];

const PROVIDERS = [
  ['Stripe', 'Takes and holds payments.'],
  ['Royal Mail', 'Delivery names, addresses and tracking.'],
  ['imeicheck.com', 'Receives IMEI numbers to check device status.'],
  ['Cloudinary', 'Stores listing and evidence photos.'],
  ['Resend', 'Sends our emails.'],
  ['Twilio', 'Sends phone verification codes.'],
  ['postcodes.io', 'Looks up postcodes you enter.'],
  ['Render', 'Hosts our website, servers and databases.'],
  ['Google Analytics', 'Measures how our website is used, if you accept it.'],
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <LegalHeader
        title="Privacy Policy"
        subtitle="What personal data VeriBuy collects, why we use it, who we share it with, and the rights you have over it."
        lastUpdated="November 2, 2026"
        badge="UK GDPR & Data Protection Act 2018"
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
            <div className={SECTION}>
              <h2 className="text-base font-bold text-[var(--color-text)] mb-3 flex items-center gap-2">
                <Shield className="w-5 h-5 text-[var(--color-green)]" aria-hidden="true" />
                The short version
              </h2>
              <ul className={LIST}>
                <li>We use your data to run the marketplace: verifying devices, taking payment, arranging delivery and resolving disputes.</li>
                <li>We don&apos;t sell your personal data or show advertising.</li>
                <li>Card details go directly to Stripe and never reach our servers.</li>
                <li>IMEI and serial numbers are never shown publicly. We use them to check devices and prevent fraud.</li>
              </ul>
            </div>

            <section id="overview" className={SECTION}>
              <h2 className={HEADING}>1. Who we are</h2>
              <p className={BODY}>
                VeriBuy LTD (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is the data controller for personal data collected through veribuy.shop and the VeriBuy app for iOS and Android. This policy explains what we collect and why, under the UK GDPR and the Data Protection Act 2018. VeriBuy is for people aged 18 and over.
              </p>
              <p className={`${BODY} mt-3`}>
                VeriBuy LTD is registered in England &amp; Wales (Company No. 17391481) and with the Information Commissioner&apos;s Office (ZC226120). Our address is Bartle House, 9 Oxford Court, Manchester, M2 3WQ.
              </p>
            </section>

            <section id="collection" className={SECTION}>
              <h2 className={HEADING}>2. Information we collect</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-[var(--color-border)] rounded-xl overflow-hidden">
                  <thead className="bg-[var(--color-surface-alt)] text-[var(--color-text)] font-semibold border-b border-[var(--color-border)]">
                    <tr>
                      <th className="p-3">Type of data</th>
                      <th className="p-3">What it includes</th>
                      <th className="p-3">Lawful basis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]/50 text-[var(--color-text-muted)]">
                    {DATA_CATEGORIES.map(([category, detail, basis]) => (
                      <tr key={category}>
                        <td className="p-3 font-semibold text-[var(--color-text)]">{category}</td>
                        <td className="p-3">{detail}</td>
                        <td className="p-3">{basis}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section id="purposes" className={SECTION}>
              <h2 className={HEADING}>3. How we use your data</h2>
              <ul className={LIST}>
                <li><strong>Running your account and orders:</strong> sign-in, listings, bids, offers, messages, payment, delivery and account emails.</li>
                <li><strong>Verifying devices:</strong> Trust Lens checks combine automated IMEI checks with review of photos and details by our team. An automated result can flag or hold a listing. Contact us if you think a decision about your listing is wrong, and a person will look at it.</li>
                <li><strong>Holding payments and resolving disputes:</strong> we use order records, messages and device photos to work out what happened.</li>
                <li><strong>Preventing fraud and abuse:</strong> including spotting devices listed repeatedly or reported as a problem.</li>
                <li><strong>Meeting legal duties:</strong> such as tax and accounting records.</li>
              </ul>
            </section>

            <section id="sharing" className={SECTION}>
              <h2 className={HEADING}>4. Who we share it with</h2>
              <p className={`${BODY} mb-3`}>
                <strong>Other users:</strong> your display name, listings and ratings are visible on VeriBuy. A seller receives the buyer&apos;s name and delivery address when there is an order to post.
              </p>
              <p className={`${BODY} mb-3`}>
                <strong>Service providers:</strong> we share only what each provider needs to do its job.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[var(--color-text)] mb-3">
                {PROVIDERS.map(([name, purpose]) => (
                  <div key={name} className="p-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-alt)]">
                    <strong>{name}</strong>
                    <p className="text-[var(--color-text-muted)] mt-1">{purpose}</p>
                  </div>
                ))}
              </div>
              <p className={BODY}>
                We may also share data where the law requires it, for example with HMRC or the police, or to protect people from fraud.
              </p>
            </section>

            <section id="transfers" className={SECTION}>
              <h2 className={HEADING}>5. International transfers</h2>
              <p className={BODY}>
                Our servers are hosted in Frankfurt, Germany. Some providers may also process data in other countries, including the United States. Where data leaves the UK, we rely on UK adequacy regulations or the safeguards the law requires, such as the ICO&apos;s International Data Transfer Agreement. Contact us for more detail.
              </p>
            </section>

            <section id="mobile-app" className={SECTION}>
              <h2 className={HEADING}>6. Our mobile app</h2>
              <ul className={LIST}>
                <li><strong>Camera and photos:</strong> used only when you choose to add photos of a device. You choose which photos to share. They are resized and location data is removed on your phone before upload.</li>
                <li><strong>Sign-in:</strong> session tokens are kept in your phone&apos;s secure storage.</li>
                <li><strong>Tracking:</strong> the app contains no advertising or analytics tools and doesn&apos;t track you across other companies&apos; apps or websites.</li>
                <li><strong>Closing your account:</strong> you can do this from Account in the app.</li>
              </ul>
            </section>

            <section id="cookies" className={SECTION}>
              <h2 className={HEADING}>7. Cookies &amp; analytics</h2>
              <p className={BODY}>
                Our website uses essential cookies to keep you signed in and secure. If you accept, it also uses Google Analytics to understand how the site is used, which sets its own cookies and sends usage data to Google. You can change your mind at any time using Cookie settings in the website footer. We don&apos;t use advertising cookies or marketing pixels. See our{' '}
                <Link href="/cookies" className="text-[var(--color-green)] font-semibold hover:underline">Cookie Policy</Link>.
              </p>
            </section>

            <section id="security" className={SECTION}>
              <h2 className={HEADING}>8. Security</h2>
              <ul className={LIST}>
                <li>Data is sent over encrypted connections (TLS).</li>
                <li>Passwords are stored only as salted hashes.</li>
                <li>On the website, sign-in tokens are kept in cookies that page scripts can&apos;t read.</li>
                <li>IMEI and serial numbers are removed from public listing data, and access is limited to the seller and the staff who need them.</li>
              </ul>
              <p className={`${BODY} mt-3`}>No system is completely secure. If a breach is likely to put you at risk, we will tell you and the ICO as the law requires.</p>
            </section>

            <section id="retention" className={SECTION}>
              <h2 className={HEADING}>9. How long we keep data</h2>
              <ul className={LIST}>
                <li><strong>Accounts:</strong> for as long as your account is open.</li>
                <li><strong>When you close your account:</strong> we remove your name, email address, profile, address and listing drafts straight away, and take your listings off sale.</li>
                <li><strong>Orders and payments:</strong> we keep these records, with related messages and device photos, for 6 years for tax and accounting and to deal with claims.</li>
                <li><strong>IMEI records:</strong> we keep a record of device identifiers after a listing ends, to prevent fraud and the resale of stolen devices.</li>
              </ul>
            </section>

            <section id="rights" className={SECTION}>
              <h2 className={HEADING}>10. Your rights</h2>
              <p className={`${BODY} mb-3`}>Under UK data protection law you can ask us to:</p>
              <ul className={LIST}>
                <li>give you a copy of your data</li>
                <li>correct anything inaccurate</li>
                <li>delete your data</li>
                <li>restrict how we use it, or object to uses based on our legitimate interests</li>
                <li>give you your data in a portable format</li>
                <li>have a person review a decision made by automated means</li>
              </ul>
              <p className={`${BODY} mt-3`}>
                These rights have limits, for example where we must keep records by law. We normally reply within one month.
              </p>
            </section>

            <section id="contact" className={SECTION}>
              <h2 className={HEADING}>11. Contact &amp; complaints</h2>
              <p className={BODY}>
                To use your rights or ask a question, contact our Data Protection Officer, Moyosore Baiye, at{' '}
                <a href="mailto:moyosorebaiye@veribuy.shop" className="text-[var(--color-green)] font-semibold hover:underline">moyosorebaiye@veribuy.shop</a>, or write to Bartle House, 9 Oxford Court, Manchester, M2 3WQ. For general support, call{' '}
                <a href="tel:03338809869" className="text-[var(--color-green)] font-semibold hover:underline">0333 880 9869</a>.
                {' '}If you&apos;re unhappy with our response, you can complain to the Information Commissioner&apos;s Office at{' '}
                <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-[var(--color-green)] font-semibold hover:underline">ico.org.uk</a>.
                {' '}If we change this policy in a meaningful way, we&apos;ll update the date above and tell you where appropriate.
              </p>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

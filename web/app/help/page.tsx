import Link from 'next/link';
import type { Metadata } from 'next';
import { faqPageJsonLd } from '@/lib/structured-data';

export const metadata: Metadata = {
  title: 'Help Centre',
  description: 'Get help with buying and selling on VeriBuy. Answers to common questions about Trust Lens verification, buyer protection, fees, and more.',
  alternates: {
    canonical: '/help',
  },
};

const faqs = [
    {
      question: 'How does Trust Lens verification work?',
      answer: 'Trust Lens is our automated verification system. When a seller creates a listing with an IMEI, we run it against global databases (GSMA blacklist, stolen device reports, iCloud lock status) in seconds. Clean results mean the listing goes live instantly and the seller is marked Verified. Flagged results go to admin review. Sellers select their own condition grade (A/B/C) and upload evidence photos for dispute protection.',
    },
    {
      question: 'Is my purchase protected?',
      answer: 'Yes! All purchases are covered by our Buyer Protection guarantee. If the device doesn\'t match the listing description, you can return it within 7 days for a full refund.',
    },
    {
      question: 'How long does verification take?',
      answer: 'IMEI checks run automatically in seconds. If the device is clean, your listing goes live immediately. If the IMEI is flagged, it enters the admin review queue which typically takes 24-48 hours. You\'ll be notified when your listing status changes.',
    },
    {
      question: 'What are the seller fees?',
      answer: 'We charge a 5% commission on successful sales. There are no listing fees or monthly subscriptions. You only pay when you sell.',
    },
    {
      question: 'Can I cancel an order?',
      answer: 'Buyers can cancel orders within 1 hour of purchase. After that, please contact the seller directly or reach out to our support team.',
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept all major credit cards, debit cards, and digital wallets. Payments are securely processed and held in escrow until delivery is confirmed.',
    },
  ];

export default function HelpPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageJsonLd(faqs)) }}
      />
      <div className="min-h-screen bg-white">
      {/* Hero */}
      <section
        aria-labelledby="help-hero-heading"
        className="relative overflow-hidden text-white"
        style={{ background: 'linear-gradient(135deg, #5C7A3E 0%, #4A6B35 30%, #8B7355 70%, #6B5A3E 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{ background: 'radial-gradient(ellipse at 60% 40%, #F5C842 0%, transparent 60%)' }}
          aria-hidden="true"
        />
        <div className="relative max-w-4xl mx-auto px-4 py-16 md:py-24 text-center">
          <h1
            id="help-hero-heading"
            className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight mb-4"
          >
            How Can We Help?
          </h1>
          <p className="text-base md:text-lg text-white/80">
            Find answers to common questions about VeriBuy
          </p>
        </div>
      </section>

      {/* FAQs */}
      <section className="max-w-4xl mx-auto px-4 py-14 md:py-16">
        <div className="space-y-6">
          {faqs.map((faq, index) => (
            <div key={index} className="bg-white rounded-xl p-6 md:p-8 border border-[var(--color-border)]">
              <h2 className="text-lg md:text-xl font-bold text-[var(--color-text)] mb-3">
                {faq.question}
              </h2>
              <p className="text-base text-[var(--color-text-muted)] leading-relaxed">
                {faq.answer}
              </p>
            </div>
          ))}
        </div>

        {/* Contact CTA */}
        <div className="mt-12 text-center bg-[var(--color-surface-alt)] rounded-2xl p-8 md:p-10">
          <h2 className="text-2xl font-bold text-[var(--color-text)] mb-3">
            Still Need Help?
          </h2>
          <p className="text-[var(--color-text-muted)] mb-6">
            Our support team is here to assist you
          </p>
          <Link
            href="/contact"
            className="inline-block bg-[var(--color-accent)] hover:bg-[var(--color-accent-dark)] text-[var(--color-primary-dark)] px-8 py-3.5 rounded-lg font-bold transition-colors shadow-md"
          >
            Contact Support
          </Link>
        </div>
      </section>
    </div>
    </>
  );
}

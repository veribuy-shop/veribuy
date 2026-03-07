import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Help Centre - VeriBuy',
  description: 'Get help with buying and selling on VeriBuy',
};

export default function HelpPage() {
  const faqs = [
    {
      question: 'How does Trust Lens verification work?',
      answer: 'Trust Lens is our 4-step verification process that checks seller identity, validates device authenticity (IMEI/serial), captures timestamped evidence photos, and assigns a condition grade (A/B/C) before any listing goes live.'
    },
    {
      question: 'Is my purchase protected?',
      answer: 'Yes! All purchases are covered by our Buyer Protection guarantee. If the device doesn\'t match the listing description, you can return it within 7 days for a full refund.'
    },
    {
      question: 'How long does verification take?',
      answer: 'Most devices are verified within 24-48 hours. You\'ll receive updates throughout the process and be notified when your listing goes live.'
    },
    {
      question: 'What are the seller fees?',
      answer: 'We charge a 5% commission on successful sales. There are no listing fees or monthly subscriptions. You only pay when you sell.'
    },
    {
      question: 'Can I cancel an order?',
      answer: 'Buyers can cancel orders within 1 hour of purchase. After that, please contact the seller directly or reach out to our support team.'
    },
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept all major credit cards, debit cards, and digital wallets. Payments are securely processed and held in escrow until delivery is confirmed.'
    }
  ];

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] text-white py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-3xl md:text-5xl font-bold mb-4">How Can We Help?</h1>
          <p className="text-lg md:text-xl text-white/90">
            Find answers to common questions about VeriBuy
          </p>
        </div>
      </div>

      {/* FAQs */}
      <div className="max-w-4xl mx-auto px-4 py-12 md:py-16">
        <div className="space-y-6">
          {faqs.map((faq, index) => (
            <div key={index} className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-[var(--color-border)]">
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
            className="inline-block bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-8 py-3 rounded-lg font-semibold transition-colors"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}

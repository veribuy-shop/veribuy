'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Search,
  Sparkles,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Lock,
  RotateCcw,
  Tag,
  CreditCard,
  Truck,
  HelpCircle,
} from 'lucide-react';
import { faqPageJsonLd } from '@/lib/structured-data';
import { getBuyerProtectionFeePercent } from '@/lib/fees';

const rawFaqs = [
  {
    category: 'Verification & Trust Lens™',
    question: 'How does Trust Lens™ automated verification work?',
    answer: 'Trust Lens™ is our proprietary automated verification engine. When a seller inputs a device IMEI, we cross-reference GSMA international carrier databases, stolen device police registers, and OEM cloud lock registries (such as Apple Find My / iCloud lock) in real-time. Clean results mean the listing publishes instantly with a verified badge. Flagged results are sent to our UK trust & safety review team.',
  },
  {
    category: 'Buyer Protection & Escrow',
    question: 'How is my payment protected in escrow?',
    answer: 'When you purchase on VeriBuy, 100% of your funds are securely held in Stripe platform escrow. The seller never receives funds upfront. The seller only receives payout after you receive the parcel and complete your 48-hour (2 days) inspection window without dispute.',
  },
  {
    category: 'Buyer Protection & Escrow',
    question: 'What is the Buyer Protection fee and what does it cover?',
    answer: 'We charge a transparent variable Buyer Protection fee calculated dynamically at checkout. This fee directly funds 100% Stripe escrow holding, real-time Trust Lens™ database checks, signature-tracked delivery insurance, 48-hour (2 days) money-back return guarantees, and dedicated UK dispute arbitration.',
  },
  {
    category: 'Buyer Protection & Escrow',
    question: 'What is the 48-hour money-back guarantee policy?',
    answer: 'If the device received differs cosmetically, mechanically, or functionally from the listing grade and timestamped evidence photos, you can open a return within 48 hours (2 days) of delivery for a full refund.',
  },
  {
    category: 'Selling on VeriBuy',
    question: 'Are there really 0% seller commission fees?',
    answer: 'Yes! VeriBuy charges £0 seller commission, £0 listing fees, and £0 monthly subscriptions. When your device sells for £500, you receive £500 directly to your UK bank account.',
  },
  {
    category: 'Selling on VeriBuy',
    question: 'How do I find my IMEI number?',
    answer: 'Dial *#06# on your phone’s call keypad, or go to Settings > General > About (iOS) or Settings > About Phone (Android). You can also find it printed on the SIM tray or original retail packaging.',
  },
  {
    category: 'Orders & Delivery',
    question: 'How does shipping and delivery tracking work?',
    answer: 'Sellers are required to ship via tracked and insured courier services within 2 business days of payment. You will receive an instant tracking number and can follow the order progress directly on your VeriBuy order tracking page.',
  },
];

export default function HelpPage() {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const categories = ['All', 'Verification & Trust Lens™', 'Buyer Protection & Escrow', 'Selling on VeriBuy', 'Orders & Delivery'];

  const filteredFaqs = rawFaqs.filter((faq) => {
    const matchesCategory = activeCategory === 'All' || faq.category === activeCategory;
    const matchesSearch =
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageJsonLd(rawFaqs)) }}
      />
      <div className="min-h-screen bg-white">
        {/* Hero */}
        <section
          aria-labelledby="help-hero-heading"
          className="relative overflow-hidden text-white"
          style={{ background: 'linear-gradient(135deg, #1C2D16 0%, #2D4720 30%, #4A6B35 70%, #2A3B22 100%)' }}
        >
          <div
            className="absolute inset-0 opacity-25"
            style={{ background: 'radial-gradient(circle at 50% 30%, #10B981 0%, transparent 60%)' }}
            aria-hidden="true"
          />
          <div className="relative max-w-4xl mx-auto px-4 py-16 md:py-24 text-center">
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 mb-6 text-xs font-bold tracking-wide uppercase text-emerald-300 shadow-sm">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span>VeriBuy Support &amp; Knowledgebase</span>
            </div>
            <h1
              id="help-hero-heading"
              className="text-3xl sm:text-4xl md:text-5xl font-black leading-tight tracking-tight mb-4 text-white"
            >
              How Can We Help You?
            </h1>
            <p className="text-base sm:text-lg text-emerald-100/90 max-w-xl mx-auto mb-8 leading-relaxed">
              Find instant answers to questions regarding Trust Lens™ verification, escrow protection, 0% seller fees, and order delivery.
            </p>

            {/* Instant Search Bar */}
            <div className="max-w-xl mx-auto">
              <div className="relative flex items-center bg-white rounded-2xl shadow-xl p-2 border border-white/30">
                <Search className="w-5 h-5 text-gray-400 ml-3 shrink-0" aria-hidden="true" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search questions (e.g. escrow, IMEI, fees, returns)..."
                  className="w-full px-4 py-2.5 text-gray-900 placeholder-gray-400 text-sm focus:outline-none font-medium bg-transparent"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Categories Bar */}
        <section className="max-w-4xl mx-auto px-4 -mt-6 relative z-10">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none justify-start sm:justify-center">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shadow-sm ${
                  activeCategory === cat
                    ? 'bg-gray-900 text-white ring-2 ring-gray-900/20'
                    : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </section>

        {/* FAQs Accordion */}
        <section className="max-w-4xl mx-auto px-4 py-12 md:py-16">
          <div className="space-y-4">
            {filteredFaqs.length === 0 ? (
              <div className="bg-[var(--color-surface-alt)] rounded-2xl p-12 text-center">
                <HelpCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-gray-900 mb-1">No matching questions found</h3>
                <p className="text-sm text-gray-500 mb-4">Try searching for other terms or contact our support team.</p>
                <button
                  onClick={() => { setSearchQuery(''); setActiveCategory('All'); }}
                  className="text-xs font-bold text-[var(--color-green)] hover:underline"
                >
                  Clear search &amp; filters
                </button>
              </div>
            ) : (
              filteredFaqs.map((faq, index) => {
                const isOpen = openIndex === index;
                return (
                  <div
                    key={faq.question}
                    className="bg-white rounded-2xl border border-[var(--color-border)] shadow-xs overflow-hidden transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenIndex(isOpen ? null : index)}
                      className="w-full text-left p-6 flex items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors"
                      aria-expanded={isOpen}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm sm:text-base font-bold text-gray-900 leading-snug">
                          {faq.question}
                        </span>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-gray-600">
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>
                    {isOpen && (
                      <div className="px-6 pb-6 pt-1 text-sm text-gray-600 leading-relaxed border-t border-gray-100">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Contact Support CTA */}
          <div className="mt-14 bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 rounded-3xl p-8 md:p-10 text-white text-center shadow-xl">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-6 h-6 text-emerald-300" />
            </div>
            <h3 className="text-2xl font-black mb-2 text-white">Still Have Questions?</h3>
            <p className="text-sm text-emerald-100/80 mb-6 max-w-md mx-auto">
              Our UK-based support team is available Monday through Friday with a guaranteed 24-hour response SLA.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 bg-[var(--color-green)] hover:bg-[var(--color-green-dark)] text-white px-8 py-3.5 rounded-xl font-bold text-sm transition-colors shadow-lg"
            >
              <span>Contact Support Team</span>
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

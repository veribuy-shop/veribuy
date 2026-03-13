import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, BadgeCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Seller Verification - VeriBuy',
};

export default function SellerVerificationPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section
        aria-labelledby="sv-hero-heading"
        className="relative overflow-hidden text-white"
        style={{ background: 'linear-gradient(135deg, #5C7A3E 0%, #4A6B35 30%, #8B7355 70%, #6B5A3E 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{ background: 'radial-gradient(ellipse at 60% 40%, #F5C842 0%, transparent 60%)' }}
          aria-hidden="true"
        />
        <div className="relative max-w-4xl mx-auto px-4 py-16 md:py-24 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/25 mb-6">
            <BadgeCheck className="w-8 h-8 text-white" aria-hidden="true" />
          </div>
          <h1
            id="sv-hero-heading"
            className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight mb-4"
          >
            Get Verified to Sell
          </h1>
          <p className="text-base md:text-lg text-white/80">
            Quick and easy verification process
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-4xl mx-auto px-4 py-14 md:py-16">
        <div className="space-y-6">
          {/* What You Need */}
          <div className="bg-white rounded-xl p-6 md:p-8 border border-[var(--color-border)]">
            <h2 className="text-xl font-bold text-[var(--color-text)] mb-4">What You&apos;ll Need</h2>
            <ul className="space-y-3 text-[var(--color-text-muted)]">
              {[
                'Government-issued ID (driver\'s license, passport)',
                'Valid email address',
                'Phone number for verification',
                'Bank account details for payouts',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <Check className="w-5 h-5 mt-0.5 text-[var(--color-accent)] flex-shrink-0" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Verification Steps */}
          <div className="bg-white rounded-xl p-6 md:p-8 border border-[var(--color-border)]">
            <h2 className="text-xl font-bold text-[var(--color-text)] mb-4">Verification Steps</h2>
            <div className="space-y-4">
              {[
                { title: 'Upload ID', desc: 'Take a photo of your government ID' },
                { title: 'Verify Contact', desc: 'Confirm email and phone number' },
                { title: 'Add Payment', desc: 'Link your bank account for payouts' },
                { title: 'Start Listing', desc: "You're verified! Begin listing devices" },
              ].map((step, i) => (
                <div key={step.title} className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-[var(--color-accent)] text-white rounded-full flex items-center justify-center font-bold text-sm">
                    {i + 1}
                  </div>
                  <div>
                    <h4 className="font-semibold text-[var(--color-text)]">{step.title}</h4>
                    <p className="text-sm text-[var(--color-text-muted)]">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="bg-[var(--color-surface-alt)] rounded-2xl p-6 md:p-8 text-center">
            <p className="text-[var(--color-text-muted)] mb-4">
              Verification typically takes 10-15 minutes
            </p>
            <Link
              href="/register"
              className="inline-block bg-[var(--color-accent)] hover:bg-[var(--color-accent-dark)] text-[var(--color-primary-dark)] px-8 py-3.5 rounded-lg font-bold transition-colors shadow-md"
            >
              Get Started
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

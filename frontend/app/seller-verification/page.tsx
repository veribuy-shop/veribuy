import type { Metadata } from 'next';
import Link from 'next/link';
import { BadgeCheck, ShieldCheck, Search, Package, Star } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Seller Verification',
  description: 'Learn how seller verification works on VeriBuy. List a device with its IMEI and our Trust Lens system verifies you automatically.',
  alternates: {
    canonical: '/seller-verification',
  },
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
            How Seller Verification Works
          </h1>
          <p className="text-base md:text-lg text-white/80">
            List a device with its IMEI and our Trust Lens system verifies you automatically
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-4xl mx-auto px-4 py-14 md:py-16">
        <div className="space-y-6">
          {/* How It Works */}
          <div className="bg-white rounded-xl p-6 md:p-8 border border-[var(--color-border)]">
            <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">How Verification Works</h2>
            <p className="text-sm text-[var(--color-text-muted)] mb-6">
              Seller verification is built into the listing process. When you create a listing
              and provide your device&apos;s IMEI, our Trust Lens system automatically runs
              checks against global databases to verify the device&apos;s legitimacy -- and yours.
            </p>
            <div className="space-y-5">
              {[
                {
                  icon: Package,
                  title: 'Create a Listing',
                  desc: 'List your device and enter its IMEI number. You can find this by dialling *#06# on most phones.',
                },
                {
                  icon: ShieldCheck,
                  title: 'Trust Lens Checks Run Automatically',
                  desc: 'Our system checks the IMEI against GSMA blacklists, stolen device reports, and iCloud lock status in seconds.',
                },
                {
                  icon: Search,
                  title: 'Clean Result = Verified Seller',
                  desc: 'If all checks pass, your listing goes live and your seller profile is automatically marked as Verified.',
                },
                {
                  icon: Star,
                  title: 'Flagged Results Get Admin Review',
                  desc: 'If any check flags an issue, an admin reviews the listing manually and makes a decision.',
                },
              ].map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-[var(--color-accent)] text-white rounded-full flex items-center justify-center font-bold text-sm">
                      {i + 1}
                    </div>
                    <div>
                      <h4 className="font-semibold text-[var(--color-text)] flex items-center gap-2">
                        <Icon className="w-4 h-4 text-[var(--color-green)]" aria-hidden="true" />
                        {step.title}
                      </h4>
                      <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* What We Check */}
          <div className="bg-white rounded-xl p-6 md:p-8 border border-[var(--color-border)]">
            <h2 className="text-xl font-bold text-[var(--color-text)] mb-4">What Trust Lens Checks</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'GSMA Blacklist', desc: 'Ensures the device is not reported lost or stolen globally' },
                { label: 'Stolen Reports', desc: 'Cross-references stolen device databases' },
                { label: 'iCloud Lock', desc: 'Checks if Find My iPhone activation lock is enabled' },
                { label: 'IMEI Validity', desc: 'Verifies the IMEI is a real, properly formatted identifier' },
              ].map((item) => (
                <div key={item.label} className="bg-[var(--color-surface-alt)] rounded-lg p-4">
                  <p className="font-semibold text-sm text-[var(--color-text)]">{item.label}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Staying Verified */}
          <div className="bg-white rounded-xl p-6 md:p-8 border border-[var(--color-border)]">
            <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">Staying Verified</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Once verified, your status carries forward to all future listings. However, if
              3 or more of your listings fail verification checks, your seller status will be
              revoked and you will need to contact support. Each new listing still undergoes
              its own IMEI verification to protect buyers.
            </p>
          </div>

          {/* CTA */}
          <div className="bg-[var(--color-surface-alt)] rounded-2xl p-6 md:p-8 text-center">
            <p className="text-[var(--color-text-muted)] mb-4">
              Ready to sell? Create your first listing to start the verification process.
            </p>
            <Link
              href="/listings/create"
              className="inline-block bg-[var(--color-accent)] hover:bg-[var(--color-accent-dark)] text-[var(--color-primary-dark)] px-8 py-3.5 rounded-lg font-bold transition-colors shadow-md"
            >
              Create a Listing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

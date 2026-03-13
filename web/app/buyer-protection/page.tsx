import type { Metadata } from 'next';
import { ShieldCheck, RefreshCcw, Lock, Scale } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Buyer Protection - VeriBuy',
};

export default function BuyerProtectionPage() {
  const protections = [
    {
      icon: <RefreshCcw className="w-7 h-7 text-[var(--color-green)]" />,
      title: '7-Day Return Guarantee',
      description: 'If your device doesn\'t match the listing description, you can return it within 7 days for a full refund. No questions asked.',
    },
    {
      icon: <ShieldCheck className="w-7 h-7 text-[var(--color-green)]" />,
      title: 'Trust Lens Verified',
      description: 'Every device has passed our rigorous verification process - IMEI checked, condition graded, and photographed with timestamped evidence.',
    },
    {
      icon: <Lock className="w-7 h-7 text-[var(--color-green)]" />,
      title: 'Secure Payments',
      description: 'Your payment is held in escrow until you confirm delivery. Sellers only get paid when you\'re satisfied.',
    },
    {
      icon: <Scale className="w-7 h-7 text-[var(--color-green)]" />,
      title: 'Dispute Resolution',
      description: 'If there\'s an issue, our support team will mediate and resolve disputes fairly using the Trust Lens evidence pack.',
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section
        aria-labelledby="bp-hero-heading"
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
            <ShieldCheck className="w-8 h-8 text-white" aria-hidden="true" />
          </div>
          <h1
            id="bp-hero-heading"
            className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight mb-4"
          >
            Buyer Protection
          </h1>
          <p className="text-base md:text-lg text-white/80">
            Shop with confidence - you&apos;re protected
          </p>
        </div>
      </section>

      {/* Protection Cards */}
      <section className="max-w-4xl mx-auto px-4 py-14 md:py-16">
        <div className="space-y-6">
          {protections.map((item) => (
            <div
              key={item.title}
              className="bg-white rounded-xl p-6 md:p-8 border border-[var(--color-border)]"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-[var(--color-green)]/10 flex items-center justify-center">
                  {item.icon}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[var(--color-text)] mb-2">{item.title}</h2>
                  <p className="text-[var(--color-text-muted)] leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

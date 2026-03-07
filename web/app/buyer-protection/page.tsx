import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Buyer Protection - VeriBuy',
};

export default function BuyerProtectionPage() {
  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      <div className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] text-white py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="text-5xl mb-4">🛡️</div>
          <h1 className="text-3xl md:text-5xl font-bold mb-4">Buyer Protection</h1>
          <p className="text-lg md:text-xl text-white/90">
            Shop with confidence - you're protected
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12 md:py-16 space-y-8">
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-[var(--color-border)]">
          <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">7-Day Return Guarantee</h2>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            If your device doesn't match the listing description, you can return it within 7 days for a full refund. No questions asked.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-[var(--color-border)]">
          <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">Trust Lens Verified</h2>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            Every device has passed our rigorous verification process - IMEI checked, condition graded, and photographed with timestamped evidence.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-[var(--color-border)]">
          <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">Secure Payments</h2>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            Your payment is held in escrow until you confirm delivery. Sellers only get paid when you're satisfied.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-[var(--color-border)]">
          <h2 className="text-2xl font-bold text-[var(--color-text)] mb-4">Dispute Resolution</h2>
          <p className="text-[var(--color-text-muted)] leading-relaxed">
            If there's an issue, our support team will mediate and resolve disputes fairly using the Trust Lens evidence pack.
          </p>
        </div>
      </div>
    </div>
  );
}

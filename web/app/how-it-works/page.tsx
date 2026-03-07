import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'How Trust Lens Works - VeriBuy',
  description: 'Learn how our verification process ensures every device is authentic and accurately described',
};

export default function HowItWorksPage() {
  const steps = [
    {
      number: '1',
      title: 'Seller Verification',
      icon: '✓',
      description: 'Before listing any device, sellers must complete identity verification. We verify government-issued ID and contact information to ensure accountability.',
      details: [
        'Government ID verification',
        'Email and phone confirmation',
        'Background checks for high-value sellers',
        'Ongoing reputation monitoring'
      ]
    },
    {
      number: '2',
      title: 'Device Authentication',
      icon: '🔍',
      description: 'Every device undergoes rigorous authentication checks to verify it\'s genuine and not stolen or blacklisted.',
      details: [
        'IMEI/serial number validation',
        'Stolen device database checks',
        'Carrier blacklist verification',
        'iCloud lock status (for Apple devices)',
        'Warranty status validation'
      ]
    },
    {
      number: '3',
      title: 'Evidence Capture',
      icon: '📸',
      description: 'Sellers capture timestamped photos and videos of the device from multiple angles, creating an immutable evidence pack.',
      details: [
        'Minimum 10 photos from all angles',
        'Video showing device functionality',
        'Screen-on photos showing no defects',
        'Close-ups of any scratches or damage',
        'All media is timestamped and stored securely'
      ]
    },
    {
      number: '4',
      title: 'Condition Grading',
      icon: '⭐',
      description: 'Devices are graded A, B, or C based on a standardized assessment of cosmetic and functional condition.',
      details: [
        'Grade A: Excellent - Like new or minimal wear',
        'Grade B: Good - Light scratches, fully functional',
        'Grade C: Fair - Visible wear, fully functional',
        'AI-assisted grading for consistency',
        'Manual review by our team'
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[var(--color-surface)]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] text-white py-12 md:py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="text-5xl md:text-6xl mb-6">🛡️</div>
          <h1 className="text-3xl md:text-5xl font-bold mb-4">How Trust Lens Works</h1>
          <p className="text-lg md:text-xl text-white/90 max-w-2xl mx-auto">
            Our 4-step verification process ensures every device is authentic, accurately described, and ready for sale
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="max-w-5xl mx-auto px-4 py-12 md:py-16">
        <div className="space-y-12 md:space-y-16">
          {steps.map((step, index) => (
            <div key={index} className="bg-white rounded-2xl p-6 md:p-10 shadow-sm border border-[var(--color-border)]">
              <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                {/* Icon */}
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-dark)] text-white rounded-2xl flex items-center justify-center text-3xl md:text-4xl shadow-lg">
                    {step.icon}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-sm font-bold text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-3 py-1 rounded-full">
                      Step {step.number}
                    </span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-[var(--color-text)] mb-4">
                    {step.title}
                  </h2>
                  <p className="text-base md:text-lg text-[var(--color-text-muted)] mb-6 leading-relaxed">
                    {step.description}
                  </p>
                  <ul className="space-y-2">
                    {step.details.map((detail, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="text-[var(--color-accent)] mt-1">✓</span>
                        <span className="text-[var(--color-text-muted)]">{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 md:mt-16 text-center bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent-dark)] rounded-2xl p-8 md:p-12 text-white">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            Ready to Buy or Sell with Confidence?
          </h2>
          <p className="text-lg text-white/90 mb-6">
            Every device on VeriBuy is Trust Lens verified
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/browse"
              className="bg-white text-[var(--color-accent-dark)] hover:bg-[var(--color-warm-beige)] px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Browse Devices
            </Link>
            <Link
              href="/sell"
              className="border-2 border-white text-white hover:bg-white hover:text-[var(--color-accent-dark)] px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Start Selling
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

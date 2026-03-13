import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ShieldCheck,
  UserCheck,
  Search,
  Camera,
  Star,
  Check,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'How Trust Lens Works - VeriBuy',
  description: 'Learn how our verification process ensures every device is authentic and accurately described',
};

export default function HowItWorksPage() {
  const steps = [
    {
      number: '1',
      title: 'Seller Verification',
      icon: <UserCheck className="w-8 h-8 md:w-10 md:h-10 text-white" />,
      description: 'Before listing any device, sellers must complete identity verification. We verify government-issued ID and contact information to ensure accountability.',
      details: [
        'Government ID verification',
        'Email and phone confirmation',
        'Background checks for high-value sellers',
        'Ongoing reputation monitoring',
      ],
    },
    {
      number: '2',
      title: 'Device Authentication',
      icon: <Search className="w-8 h-8 md:w-10 md:h-10 text-white" />,
      description: 'Every device undergoes rigorous authentication checks to verify it\'s genuine and not stolen or blacklisted.',
      details: [
        'IMEI/serial number validation',
        'Stolen device database checks',
        'Carrier blacklist verification',
        'iCloud lock status (for Apple devices)',
        'Warranty status validation',
      ],
    },
    {
      number: '3',
      title: 'Evidence Capture',
      icon: <Camera className="w-8 h-8 md:w-10 md:h-10 text-white" />,
      description: 'Sellers capture timestamped photos and videos of the device from multiple angles, creating an immutable evidence pack.',
      details: [
        'Minimum 10 photos from all angles',
        'Video showing device functionality',
        'Screen-on photos showing no defects',
        'Close-ups of any scratches or damage',
        'All media is timestamped and stored securely',
      ],
    },
    {
      number: '4',
      title: 'Condition Grading',
      icon: <Star className="w-8 h-8 md:w-10 md:h-10 text-white" />,
      description: 'Devices are graded A, B, or C based on a standardized assessment of cosmetic and functional condition.',
      details: [
        'Grade A: Excellent - Like new or minimal wear',
        'Grade B: Good - Light scratches, fully functional',
        'Grade C: Fair - Visible wear, fully functional',
        'AI-assisted grading for consistency',
        'Manual review by our team',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section
        aria-labelledby="how-hero-heading"
        className="relative overflow-hidden text-white"
        style={{ background: 'linear-gradient(135deg, #5C7A3E 0%, #4A6B35 30%, #8B7355 70%, #6B5A3E 100%)' }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{ background: 'radial-gradient(ellipse at 60% 40%, #F5C842 0%, transparent 60%)' }}
          aria-hidden="true"
        />
        <div className="relative max-w-4xl mx-auto px-4 py-16 md:py-24 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/25 mb-6">
            <ShieldCheck className="w-8 h-8 md:w-10 md:h-10 text-white" aria-hidden="true" />
          </div>
          <h1
            id="how-hero-heading"
            className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight mb-4"
          >
            How Trust Lens Works
          </h1>
          <p className="text-base md:text-lg text-white/80 max-w-2xl mx-auto">
            Our 4-step verification process ensures every device is authentic, accurately described, and ready for sale
          </p>
        </div>
      </section>

      {/* Steps */}
      <section
        aria-labelledby="steps-heading"
        className="max-w-5xl mx-auto px-4 py-14 md:py-16"
      >
        <h2 id="steps-heading" className="sr-only">Verification Steps</h2>
        <div className="space-y-8 md:space-y-12">
          {steps.map((step, index) => (
            <div key={index} className="bg-white rounded-xl p-6 md:p-10 border border-[var(--color-border)]">
              <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                {/* Icon */}
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-[var(--color-accent)] rounded-2xl flex items-center justify-center">
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
                  <h3 className="text-2xl md:text-3xl font-bold text-[var(--color-text)] mb-4">
                    {step.title}
                  </h3>
                  <p className="text-base md:text-lg text-[var(--color-text-muted)] mb-6 leading-relaxed">
                    {step.description}
                  </p>
                  <ul className="space-y-2">
                    {step.details.map((detail, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <Check className="w-4 h-4 mt-1 text-[var(--color-accent)] flex-shrink-0" aria-hidden="true" />
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
        <div className="mt-12 md:mt-16 bg-[var(--color-primary)] rounded-2xl p-8 md:p-12 text-white text-center">
          <h3 className="text-2xl md:text-3xl font-bold mb-3">
            Ready to Buy or Sell with Confidence?
          </h3>
          <p className="text-base text-white/75 mb-8">
            Every device on VeriBuy is Trust Lens verified
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/browse"
              className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-dark)] text-[var(--color-primary-dark)] px-8 py-3.5 rounded-lg font-bold text-base transition-colors shadow-md"
            >
              Browse Devices
            </Link>
            <Link
              href="/sell"
              className="border border-white/40 hover:border-white text-white px-8 py-3.5 rounded-lg font-semibold text-base transition-colors"
            >
              Start Selling
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

import type { Metadata } from 'next';
import SellContent from './sell-content';

export const metadata: Metadata = {
  title: 'Start Selling',
  description: 'Sell your electronics on VeriBuy. Only 5% commission, no listing fees. Trust Lens verification builds buyer confidence for faster sales.',
  alternates: {
    canonical: '/sell',
  },
  openGraph: {
    title: 'Start Selling on VeriBuy',
    description: 'Sell your electronics with Trust Lens verification. Only 5% commission, no listing fees.',
  },
};

export default function SellPage() {
  return <SellContent />;
}

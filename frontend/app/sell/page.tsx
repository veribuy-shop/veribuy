import type { Metadata } from 'next';
import SellContent from './sell-content';

export const metadata: Metadata = {
  title: 'Start Selling',
  description: 'Sell your electronics on VeriBuy with 0% selling fees. Keep 100% of your earnings. Trust Lens verification builds buyer confidence for faster sales.',
  alternates: {
    canonical: '/sell',
  },
  openGraph: {
    title: 'Start Selling on VeriBuy',
    description: 'Sell your electronics with 0% seller commission and Trust Lens verification. Keep 100% of your earnings.',
  },
};

export default function SellPage() {
  return <SellContent />;
}

import type { Metadata } from 'next';
import BrowseContent from './browse-content';

export const metadata: Metadata = {
  title: 'Browse Verified Devices',
  description: 'Browse Trust Lens verified smartphones, tablets, and smartwatches. Filter by condition grade, price, and device type.',
  alternates: {
    canonical: '/browse',
  },
  openGraph: {
    title: 'Browse Verified Devices | VeriBuy',
    description: 'Browse Trust Lens verified smartphones, tablets, and smartwatches. Every device checked before it goes live.',
  },
};

export default function BrowsePage() {
  return <BrowseContent />;
}

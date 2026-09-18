import { Suspense } from 'react';
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
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--color-surface)] py-12 text-center text-sm text-[var(--color-text-muted)]">Loading marketplace catalog...</div>}>
      <BrowseContent />
    </Suspense>
  );
}

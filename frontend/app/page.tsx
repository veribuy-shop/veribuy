import type { Metadata } from 'next';
import HomeContent from './home-content';
import { organizationJsonLd, webSiteJsonLd } from '@/lib/structured-data';
import { serializeJsonLd } from '@/lib/json-ld';

export const metadata: Metadata = {
  title: 'VeriBuy — Verified Electronics Marketplace',
  description: 'Buy and sell verified, pre-authenticated electronic devices with confidence. Every device checked by Trust Lens before it goes live.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'VeriBuy — Verified Electronics Marketplace',
    description: 'Buy and sell verified, pre-authenticated electronic devices with confidence. Every device checked by Trust Lens.',
    type: 'website',
  },
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(organizationJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(webSiteJsonLd()) }}
      />
      <HomeContent />
    </>
  );
}

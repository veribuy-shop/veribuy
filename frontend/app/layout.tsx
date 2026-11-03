import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AnalyticsConsent } from '@/components/analytics-consent';
import { ClientLayout } from '@/components/client-layout';
import { MarketplaceConfigProvider } from '@/components/marketplace-config-provider';
import { loadMarketplaceConfig } from '@/lib/marketplace-config-server';

// Keeps pre-rendered pages in step with the backend's marketplace rules.
export const revalidate = 60;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.veribuy.shop';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#232F3E',
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: '%s | VeriBuy',
    default: 'VeriBuy — Verified Electronics Marketplace',
  },
  description: 'Buy and sell verified, pre-authenticated electronic devices with confidence. Trust Lens ensures every listing is authentic.',
  icons: {
    icon: '/veribuy-logo.png',
    apple: '/veribuy-logo.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'VeriBuy',
    locale: 'en_GB',
    title: 'VeriBuy — Verified Electronics Marketplace',
    description: 'Buy and sell verified, pre-authenticated electronic devices with confidence. Trust Lens ensures every listing is authentic.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VeriBuy — Verified Electronics Marketplace',
    description: 'Buy and sell verified, pre-authenticated electronic devices with confidence.',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: '/',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const config = await loadMarketplaceConfig();

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <MarketplaceConfigProvider config={config}>
          <ClientLayout>{children}</ClientLayout>
        </MarketplaceConfigProvider>
        <AnalyticsConsent />
      </body>
    </html>
  );
}

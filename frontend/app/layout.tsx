import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import { ClientLayout } from '@/components/client-layout';

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-SQ22TQ686Z"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', 'G-SQ22TQ686Z');
          `}
        </Script>
      </head>
      <body className="min-h-screen flex flex-col">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}

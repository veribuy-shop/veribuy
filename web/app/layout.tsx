import type { Metadata } from 'next';
import './globals.css';
import { ClientLayout } from '@/components/client-layout';

export const metadata: Metadata = {
  title: 'VeriBuy — Verified Electronics Marketplace',
  description: 'Buy and sell verified, pre-authenticated electronic devices with confidence. Trust Lens ensures every listing is authentic.',
  icons: {
    icon: '/icon',
    apple: '/apple-icon',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}

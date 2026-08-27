import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with the VeriBuy support team. We typically respond within 24 hours during business days.',
  alternates: {
    canonical: '/contact',
  },
  openGraph: {
    title: 'Contact Us | VeriBuy',
    description: 'Get in touch with the VeriBuy support team. We typically respond within 24 hours.',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}

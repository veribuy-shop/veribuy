import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Join VeriBuy to buy and sell verified electronics. Free to sign up, only pay when you sell.',
  alternates: {
    canonical: '/register',
  },
  openGraph: {
    title: 'Create Account | VeriBuy',
    description: 'Join VeriBuy to buy and sell verified electronics. Free to sign up.',
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}

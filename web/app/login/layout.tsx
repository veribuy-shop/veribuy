import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your VeriBuy account to buy and sell verified electronics.',
  alternates: {
    canonical: '/login',
  },
  openGraph: {
    title: 'Sign In | VeriBuy',
    description: 'Sign in to your VeriBuy account to buy and sell verified electronics.',
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}

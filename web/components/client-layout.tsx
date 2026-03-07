'use client';

import { AuthProvider } from '@/lib/auth-context';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </AuthProvider>
  );
}

'use client';

import { usePathname } from 'next/navigation';
import { AuthProvider } from '@/lib/auth-context';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin =
    pathname?.startsWith('/admin') ||
    pathname === '/dashboard';

  if (isAdmin) {
    return (
      <AuthProvider>
        {children}
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <Header />
      <main className="flex-1 flex flex-col">{children}</main>
      <Footer />
    </AuthProvider>
  );
}

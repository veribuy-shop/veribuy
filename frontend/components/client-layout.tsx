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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:z-[100] focus:top-3 focus:left-3 focus:px-4 focus:py-2 focus:bg-[var(--color-primary)] focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none font-semibold text-sm"
      >
        Skip to main content
      </a>
      <Header />
      <main id="main-content" className="flex-1 flex flex-col" tabIndex={-1}>
        {children}
      </main>
      <Footer />
    </AuthProvider>
  );
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useState, useEffect, useRef } from 'react';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const mobileToggleRef = useRef<HTMLButtonElement>(null);
  const mobileMenuId = 'mobile-nav-menu';

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/browse?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Escape key closes mobile menu and returns focus to toggle button
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
        mobileToggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      {/* Main nav */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Logo */}
          <Link href="/" className="text-2xl font-bold text-[var(--color-primary)] shrink-0">
            VeriBuy
          </Link>

          {/* Desktop Search - Hidden on mobile */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xl" role="search">
            <div className="flex w-full shadow-sm rounded-lg overflow-hidden border border-[var(--color-border)]">
              <label htmlFor="desktop-search" className="sr-only">Search verified devices</label>
              <input
                id="desktop-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search verified devices..."
                autoComplete="off"
                className="flex-1 px-4 py-2.5 text-[var(--color-text)] bg-white outline-none text-sm"
              />
              <button
                type="submit"
                aria-label="Submit search"
                className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] px-6 transition-colors"
              >
                <svg aria-hidden="true" className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>

          {/* Desktop Navigation */}
          <nav aria-label="Main navigation" className="hidden md:flex items-center gap-6 text-sm font-medium">
            {user?.role === 'ADMIN' ? (
              /* Admin nav — no marketplace links */
              <>
                {pathname !== '/admin' && (
                  <Link href="/admin" className="text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors">
                    Dashboard
                  </Link>
                )}
                {pathname !== '/admin' && !pathname.startsWith('/admin/') && null}
                <span className="px-3 py-1 text-xs font-semibold bg-purple-100 text-purple-700 rounded-full">
                  Admin
                </span>
                <button
                  onClick={logout}
                  className="text-[var(--color-text)] hover:text-red-600 transition-colors text-sm"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link href="/browse" className="text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors">
                  Browse
                </Link>
                <Link href="/sell" className="text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors">
                  Sell
                </Link>
                <Link href="/how-it-works" className="text-[var(--color-accent)] hover:text-[var(--color-accent-dark)] transition-colors font-semibold">
                  Trust Lens
                </Link>

                {user ? (
                  <>
                    {pathname !== '/dashboard' && (
                      <Link
                        href="/dashboard"
                        className="text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors"
                      >
                        Dashboard
                      </Link>
                    )}
                    <div className="flex items-center gap-3">
                      <Link
                        href="/settings"
                        aria-label="Settings"
                        className="p-2 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
                      >
                        <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </Link>
                      <button
                        onClick={logout}
                        className="text-[var(--color-text)] hover:text-red-600 transition-colors text-sm"
                      >
                        Logout
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {pathname !== '/login' && (
                      <Link href="/login" className="text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors">
                        Sign In
                      </Link>
                    )}
                    {pathname !== '/register' && (
                      <Link
                        href="/register"
                        className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-5 py-2 rounded-lg transition-colors"
                      >
                        Get Started
                      </Link>
                    )}
                  </>
                )}
              </>
            )}
          </nav>

          {/* Mobile Menu Button */}
          <button
            ref={mobileToggleRef}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-[var(--color-text)] hover:text-[var(--color-primary)]"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls={mobileMenuId}
          >
            <svg aria-hidden="true" className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Search - Shown on mobile */}
        <form onSubmit={handleSearch} className="md:hidden mt-3" role="search">
          <div className="flex w-full shadow-sm rounded-lg overflow-hidden border border-[var(--color-border)]">
            <label htmlFor="mobile-search" className="sr-only">Search devices</label>
            <input
              id="mobile-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search devices..."
              autoComplete="off"
              className="flex-1 px-4 py-2.5 text-[var(--color-text)] bg-white outline-none text-sm"
            />
            <button
              type="submit"
              aria-label="Submit search"
              className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] px-4 transition-colors"
            >
              <svg aria-hidden="true" className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </form>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div id={mobileMenuId} className="md:hidden border-t border-[var(--color-border)] bg-white">
          <nav aria-label="Mobile navigation" className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-3">
            {user?.role === 'ADMIN' ? (
              /* Admin mobile nav */
              <>
                <div className="flex items-center gap-2 py-2">
                  <span className="px-3 py-1 text-xs font-semibold bg-purple-100 text-purple-700 rounded-full">Admin</span>
                </div>
                {pathname !== '/admin' && (
                  <Link
                    href="/admin"
                    className="text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors py-2 text-base font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Admin Dashboard
                  </Link>
                )}
                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="text-left text-red-600 hover:text-red-700 transition-colors py-2 text-base font-medium"
                >
                  Logout
                </button>
              </>
            ) : (
              /* Regular user mobile nav */
              <>
                <Link
                  href="/browse"
                  className="text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors py-2 text-base font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Browse Devices
                </Link>
                <Link
                  href="/sell"
                  className="text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors py-2 text-base font-medium"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sell Device
                </Link>
                <Link
                  href="/how-it-works"
                  className="text-[var(--color-accent)] hover:text-[var(--color-accent-dark)] transition-colors py-2 text-base font-semibold"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  How Trust Lens Works
                </Link>
                <div className="border-t border-[var(--color-border)] my-2"></div>

                {user ? (
                  <>
                    {pathname !== '/dashboard' && (
                      <Link
                        href="/dashboard"
                        className="text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors py-2 text-base font-medium"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        My Dashboard
                      </Link>
                    )}
                    <Link
                      href="/settings"
                      className="text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors py-2 text-base font-medium"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setMobileMenuOpen(false);
                      }}
                      className="text-left text-red-600 hover:text-red-700 transition-colors py-2 text-base font-medium"
                    >
                      Logout
                    </button>
                  </>
                ) : (
                  <>
                    {pathname !== '/login' && (
                      <Link
                        href="/login"
                        className="text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors py-2 text-base font-medium"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Sign In
                      </Link>
                    )}
                    {pathname !== '/register' && (
                      <Link
                        href="/register"
                        className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] text-white px-5 py-3 rounded-lg transition-colors text-center font-semibold"
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Get Started
                      </Link>
                    )}
                  </>
                )}
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

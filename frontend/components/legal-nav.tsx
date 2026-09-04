'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FileText, Shield, Cookie, ShieldCheck, Printer } from 'lucide-react';

interface LegalNavProps {
  title: string;
  subtitle: string;
  lastUpdated?: string;
  badge?: string;
}

export function LegalHeader({ title, subtitle, lastUpdated = 'September 4, 2026', badge = 'Official Policy' }: LegalNavProps) {
  const pathname = usePathname();

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const navItems = [
    { href: '/terms', label: 'Terms & Conditions', icon: FileText },
    { href: '/privacy', label: 'Privacy Policy', icon: Shield },
    { href: '/cookies', label: 'Cookie Policy', icon: Cookie },
    { href: '/buyer-protection', label: 'Buyer Protection', icon: ShieldCheck },
  ];

  return (
    <div className="bg-[var(--color-surface-alt)] border-b border-[var(--color-border)]">
      <div className="max-w-6xl mx-auto px-4 pt-10 pb-6">
        {/* Breadcrumb & Badge */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[var(--color-green)]/15 text-[var(--color-green)] border border-[var(--color-green)]/30">
              {badge}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              Last updated: {lastUpdated}
            </span>
          </div>

          <button
            onClick={handlePrint}
            type="button"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] bg-white px-3 py-1.5 rounded-lg border border-[var(--color-border)] transition-colors print:hidden"
          >
            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            Print Policy
          </button>
        </div>

        {/* Title & Subtitle */}
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[var(--color-text)] tracking-tight mb-2">
          {title}
        </h1>
        <p className="text-base text-[var(--color-text-muted)] max-w-3xl mb-8">
          {subtitle}
        </p>

        {/* Legal Suite Tabs */}
        <nav aria-label="Legal documents navigation" className="flex overflow-x-auto gap-2 border-b border-[var(--color-border)] pb-px scrollbar-none print:hidden">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap rounded-t-lg transition-colors border-b-2 ${
                  isActive
                    ? 'border-[var(--color-green)] text-[var(--color-green)] bg-white shadow-sm'
                    : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-white/50'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

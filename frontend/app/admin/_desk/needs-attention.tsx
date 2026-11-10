'use client';

import { ClipboardCheck, Copy, PackageX, Scale, Wallet } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatPrice } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { ageOf, deskTheme } from './shared';

export type DeskSummary = {
  reviewWaiting: number;
  oldestReviewAt: string | null;
  disputes: number;
  overduePosting: number;
  postingOverdueDays: number;
  heldAmount: number;
  unpaidCheckouts: number;
  duplicateGroups: number;
  payoutIssues?: number;
};

/** Reloads whenever `version` changes, so counts stay right after an action elsewhere. */
export function useDeskSummary(version: number) {
  const [summary, setSummary] = useState<DeskSummary | null>(null);
  useEffect(() => {
    let current = true;
    fetch('/api/admin/desk/summary', { credentials: 'include' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (current && data) setSummary(data);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [version]);
  return summary;
}

export function NeedsAttention({
  summary,
  isDarkMode,
  onOpen,
}: {
  summary: DeskSummary | null;
  isDarkMode: boolean;
  onOpen: (tab: 'verification' | 'listings' | 'orders', view?: string) => void;
}) {
  const theme = deskTheme(isDarkMode);
  const items = [
    {
      icon: ClipboardCheck,
      label: 'Waiting for review',
      value: summary?.reviewWaiting,
      note: summary?.oldestReviewAt ? `Longest wait ${ageOf(summary.oldestReviewAt)}` : 'Queue is clear',
      urgent: !!summary?.reviewWaiting,
      open: () => onOpen('verification'),
    },
    {
      icon: Scale,
      label: 'Open disputes',
      value: summary?.disputes,
      note: 'Payment frozen until decided',
      urgent: !!summary?.disputes,
      open: () => onOpen('orders', 'disputed'),
    },
    {
      icon: PackageX,
      label: 'Posting overdue',
      value: summary?.overduePosting,
      note: summary ? `Paid over ${summary.postingOverdueDays} days ago, not posted` : 'Paid, not posted',
      urgent: !!summary?.overduePosting,
      open: () => onOpen('orders', 'attention'),
    },
    {
      icon: Copy,
      label: 'Possible duplicates',
      value: summary?.duplicateGroups,
      note: 'Open listings for one device',
      urgent: !!summary?.duplicateGroups,
      open: () => onOpen('listings', 'duplicates'),
    },
    {
      icon: Wallet,
      label: 'Held in escrow',
      value: summary ? formatPrice(summary.heldAmount, 'GBP') : undefined,
      note: `${summary?.unpaidCheckouts ?? 0} unpaid ${summary?.unpaidCheckouts === 1 ? 'checkout' : 'checkouts'} open`,
      urgent: false,
      open: () => onOpen('orders', 'escrow'),
    },
  ];

  return (
    <section aria-label="Needs attention" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 mb-6">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          onClick={item.open}
          className={cn(
            'text-left border rounded-2xl p-4 transition-colors',
            item.urgent ? 'border-amber-300 bg-amber-50/70 hover:bg-amber-50' : cn(theme.card, theme.row),
          )}
        >
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <item.icon className="w-3.5 h-3.5" aria-hidden="true" /> {item.label}
          </span>
          <span className={cn('block text-2xl font-bold mt-1', item.urgent ? 'text-slate-900' : theme.text)}>{item.value ?? '—'}</span>
          <span className={cn('block text-[11px] mt-0.5', item.urgent ? 'text-slate-600' : theme.muted)}>{item.note}</span>
        </button>
      ))}
    </section>
  );
}

'use client';

import Link from 'next/link';
import { useCallback, useState } from 'react';
import { formatPrice } from '@/lib/currency';
import { cn } from '@/lib/utils';
import {
  ACTION_BUTTON,
  ActionDialog,
  deskTheme,
  DeskProps,
  FilterChips,
  Notice,
  NoticeState,
  Pager,
  PendingAction,
  shortDate,
  TableState,
  useDeskData,
} from './shared';

type PayoutRow = {
  id: string;
  orderId: string;
  listingTitle: string | null;
  amount: number;
  currency: string;
  status: string;
  stripeTransferId: string | null;
  failureReason: string | null;
  attempts: number;
  paidAt: string | null;
  flaggedAt: string | null;
  flaggedReason: string | null;
  stripeReversalId: string | null;
  reversedAt: string | null;
  createdAt: string;
  sellerName: string;
  sellerEmail: string | null;
  sellerPayoutsEnabled: boolean;
};

const VIEWS = [
  { id: 'attention', label: 'Needs attention' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'paid', label: 'Paid' },
  { id: 'reversed', label: 'Taken back' },
  { id: 'all', label: 'All' },
];

const STATUS: Record<string, { label: string; tone: string }> = {
  PENDING: { label: 'Being sent', tone: 'bg-amber-50 text-amber-800 border-amber-200' },
  AWAITING_SELLER: { label: 'Waiting for seller', tone: 'bg-amber-50 text-amber-800 border-amber-200' },
  PAID: { label: 'Paid', tone: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  FAILED: { label: 'Failed', tone: 'bg-red-50 text-red-800 border-red-200' },
  ON_HOLD: { label: 'On hold', tone: 'bg-red-50 text-red-800 border-red-200' },
  REVERSED: { label: 'Taken back', tone: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const OUTCOME: Record<string, string> = {
  PAID: 'was paid.',
  AWAITING_SELLER: 'is still waiting for the seller to finish payout setup with Stripe.',
  ON_HOLD: 'is still on hold.',
  FAILED: 'failed again.',
  PENDING: 'is being sent.',
};

export function PayoutsDesk({ isDarkMode, onChanged }: DeskProps) {
  const theme = deskTheme(isDarkMode);
  const [view, setView] = useState('attention');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const { rows, total, counts, limit, loading, error, reload } = useDeskData<PayoutRow>('payouts', { view, page: String(page), limit: '25' });

  const dismiss = useCallback(() => setNotice(null), []);
  const ref = (row: PayoutRow) => `#${row.orderId.slice(0, 8).toUpperCase()}`;
  const amount = (row: PayoutRow) => formatPrice(row.amount, row.currency);

  const retry = (row: PayoutRow) =>
    setPending({
      title: `Send ${amount(row)} to ${row.sellerName}?`,
      body:
        row.status === 'ON_HOLD'
          ? `This payout is on hold: ${row.failureReason ?? 'no reason recorded'}. It is only sent if the order is completed and the buyer's payment has not been refunded or charged back.`
          : `We'll try the Stripe transfer for order ${ref(row)} again. A payout is never sent twice.`,
      confirmLabel: 'Try payout',
      run: async () => {
        const response = await fetch(`/api/admin/payouts/${row.id}/retry`, { method: 'POST', credentials: 'include' });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || 'That did not work. Please try again.');
        const paid = data?.status === 'PAID';
        setNotice({
          type: paid ? 'success' : 'error',
          text: `Payout for order ${ref(row)} ${OUTCOME[data?.status] ?? 'was not paid.'}${!paid && data?.failureReason ? ` ${data.failureReason}.` : ''}`,
        });
        await reload();
        onChanged?.();
      },
    });

  const act = async (row: PayoutRow, action: 'reverse' | 'dismiss-flag', done: string) => {
    const response = await fetch(`/api/admin/payouts/${row.id}/${action}`, { method: 'POST', credentials: 'include' });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error || 'That did not work. Please try again.');
    setNotice({ type: 'success', text: done });
    await reload();
    onChanged?.();
  };

  const takeBack = (row: PayoutRow) =>
    setPending({
      title: `Take ${amount(row)} back from ${row.sellerName}?`,
      body: `${row.flaggedReason ?? 'The buyer payment was returned'}. The money is pulled back from the seller's Stripe balance to VeriBuy. This can't be undone, and Stripe will refuse if the seller has already withdrawn it.`,
      confirmLabel: `Take back ${amount(row)}`,
      danger: true,
      run: () => act(row, 'reverse', `${amount(row)} for order ${ref(row)} was taken back from the seller.`),
    });

  const leave = (row: PayoutRow) =>
    setPending({
      title: `Leave ${amount(row)} with ${row.sellerName}?`,
      body: `${row.flaggedReason ?? 'The buyer payment was returned'}. The seller keeps the payout and this stops showing under Needs attention. VeriBuy covers the cost.`,
      confirmLabel: 'Leave with seller',
      run: () => act(row, 'dismiss-flag', `The payout for order ${ref(row)} was left with the seller.`),
    });

  return (
    <section className={cn('border rounded-2xl overflow-hidden', theme.card)} aria-label="Seller payouts">
      <div className={cn('p-4 border-b space-y-3', theme.divider)}>
        <div>
          <h3 className={cn('text-sm font-bold', theme.text)}>Seller payouts</h3>
          <p className={cn('text-xs mt-0.5', theme.muted)}>
            When an order completes, the seller&apos;s share is sent to their Stripe account automatically. Needs attention means Stripe
            refused the transfer, or the buyer&apos;s payment was refunded or charged back (before or after the seller was paid). Waiting means the seller hasn&apos;t finished
            payout setup; it is sent as soon as they do.
          </p>
        </div>
        <FilterChips
          views={VIEWS}
          active={view}
          counts={counts}
          onSelect={(id) => {
            setView(id);
            setPage(1);
          }}
          isDarkMode={isDarkMode}
        />
      </div>
      <div className="px-4 pt-4 empty:hidden">
        <Notice notice={notice} onDismiss={dismiss} />
      </div>
      {rows.length === 0 ? (
        <TableState
          loading={loading}
          error={error}
          empty={view === 'attention' ? 'No payouts need attention.' : 'No payouts here yet.'}
          onRetry={reload}
          isDarkMode={isDarkMode}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={theme.head}>
              <tr>
                <th className="p-3 font-semibold">Order</th>
                <th className="p-3 font-semibold">Seller</th>
                <th className="p-3 font-semibold">Payout</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">Owed since</th>
                <th className={cn('p-3 sticky right-0', theme.head)}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className={cn('divide-y', theme.divider)}>
              {rows.map((row) => {
                const status = STATUS[row.status];
                return (
                  <tr key={row.id} className={theme.row}>
                    <td className="p-3 min-w-[200px]">
                      <p className={cn('font-semibold truncate max-w-[260px]', theme.text)}>{row.listingTitle || 'Untitled item'}</p>
                      <p className={theme.muted}>{ref(row)}</p>
                    </td>
                    <td className="p-3">
                      <p className={cn('font-medium', theme.text)}>{row.sellerName}</p>
                      <p className={theme.muted}>{row.sellerEmail}</p>
                    </td>
                    <td className={cn('p-3 font-semibold whitespace-nowrap', theme.text)}>{amount(row)}</td>
                    <td className="p-3 max-w-[280px]">
                      <span className={cn('inline-block px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap', status?.tone ?? 'bg-slate-100 text-slate-700 border-slate-200')}>
                        {status?.label ?? row.status}
                      </span>
                      {row.status === 'PAID' && row.flaggedAt ? (
                        <p className="mt-1 font-semibold text-red-700">{row.flaggedReason}</p>
                      ) : null}
                      {row.status === 'PAID' ? (
                        <p className={cn('mt-1', theme.muted)}>
                          {row.paidAt ? shortDate(row.paidAt) : ''} · <span className="font-mono">{row.stripeTransferId}</span>
                        </p>
                      ) : row.status === 'REVERSED' ? (
                        <p className={cn('mt-1', theme.muted)}>
                          {row.reversedAt ? shortDate(row.reversedAt) : ''} · <span className="font-mono">{row.stripeReversalId}</span>
                        </p>
                      ) : row.failureReason ? (
                        <p className={cn('mt-1', theme.muted)}>{row.failureReason}</p>
                      ) : null}
                    </td>
                    <td className={cn('p-3 whitespace-nowrap', theme.muted)}>{shortDate(row.createdAt)}</td>
                    <td className={cn('p-3 sticky right-0', isDarkMode ? 'bg-neutral-900' : 'bg-white')}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/orders/${row.orderId}/tracking`} className={cn(ACTION_BUTTON, theme.button)} aria-label={`Open order ${ref(row)}`}>Open</Link>
                        {row.status !== 'PAID' && row.status !== 'REVERSED' ? (
                          <button type="button" onClick={() => retry(row)} className={cn(ACTION_BUTTON, theme.button)}>Try payout</button>
                        ) : null}
                        {row.status === 'PAID' && row.flaggedAt ? (
                          <>
                            <button type="button" onClick={() => leave(row)} className={cn(ACTION_BUTTON, theme.button)}>Leave with seller</button>
                            <button type="button" onClick={() => takeBack(row)} className={cn(ACTION_BUTTON, theme.danger)}>Take money back</button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={total} limit={limit} onPage={setPage} isDarkMode={isDarkMode} />
      <ActionDialog action={pending} onClose={() => setPending(null)} onFailed={reload} isDarkMode={isDarkMode} />
    </section>
  );
}

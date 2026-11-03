'use client';

import { AlertTriangle } from 'lucide-react';
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
  SearchBox,
  sendAction,
  shortDate,
  StatusBadge,
  TableState,
  useDeskData,
} from './shared';

type OrderRow = {
  id: string;
  listingTitle: string | null;
  status: string;
  totalAmount: number;
  currency: string;
  trackingNumber: string | null;
  createdAt: string;
  buyerName: string;
  buyerEmail: string | null;
  sellerName: string;
  sellerEmail: string | null;
  postingOverdue: boolean;
};

const VIEWS = [
  { id: 'attention', label: 'Needs attention' },
  { id: 'all', label: 'All' },
  { id: 'escrow', label: 'Held, to post' },
  { id: 'transit', label: 'Posted or delivered' },
  { id: 'disputed', label: 'Disputed' },
  { id: 'completed', label: 'Completed' },
  { id: 'refunded', label: 'Refunded' },
  { id: 'unpaid', label: 'Not paid' },
  { id: 'cancelled', label: 'Cancelled' },
];

const REFUNDABLE = ['PAYMENT_RECEIVED', 'ESCROW_HELD', 'SHIPPED', 'DELIVERED', 'DISPUTED'];

export function OrdersDesk({ isDarkMode, onChanged, initialView = 'all' }: DeskProps & { initialView?: string }) {
  const theme = deskTheme(isDarkMode);
  const [view, setView] = useState(initialView);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const { rows, total, counts, limit, loading, error, reload } = useDeskData<OrderRow>('orders', { view, search, page: String(page), limit: '25' });

  const dismiss = useCallback(() => setNotice(null), []);
  const onSearch = useCallback((term: string) => {
    setSearch(term);
    setPage(1);
  }, []);

  const finish = async (text: string) => {
    setNotice({ type: 'success', text });
    await reload();
    onChanged?.();
  };

  const ref = (row: OrderRow) => `#${row.id.slice(0, 8).toUpperCase()}`;
  const amount = (row: OrderRow) => formatPrice(row.totalAmount, row.currency);

  const cancel = (row: OrderRow) =>
    setPending({
      title: 'Cancel this unpaid checkout?',
      body: `${row.buyerName} hasn’t paid, so nothing is refunded. The payment is closed so it can’t go through later, and the item goes back on sale. The record stays here as Cancelled.`,
      confirmLabel: 'Cancel checkout',
      danger: true,
      run: async () => {
        await sendAction(`/api/admin/orders/${row.id}`, 'DELETE');
        await finish(`Checkout ${ref(row)} was cancelled.`);
      },
    });

  const refund = (row: OrderRow) =>
    setPending({
      title: `Refund ${amount(row)} to the buyer?`,
      body: `The money goes back to ${row.buyerName} through Stripe. This can’t be undone.`,
      confirmLabel: `Refund ${amount(row)}`,
      danger: true,
      reasonLabel: 'Reason, kept in the activity log',
      run: async (reason) => {
        await sendAction(`/api/admin/orders/${row.id}/refund`, 'POST', { reason });
        await finish(`Order ${ref(row)} was refunded.`);
      },
    });

  const release = (row: OrderRow) =>
    setPending({
      title: 'Close this dispute and pay the seller?',
      body: `${row.sellerName} gets paid and ${row.buyerName} can no longer get a refund through VeriBuy. This can’t be undone.`,
      confirmLabel: 'Pay the seller',
      reasonLabel: 'Reason, kept in the activity log',
      run: async (reason) => {
        await sendAction(`/api/admin/orders/${row.id}`, 'PATCH', { status: 'COMPLETED', reason });
        await finish(`Order ${ref(row)} was completed and the seller paid.`);
      },
    });

  return (
    <section className={cn('border rounded-2xl overflow-hidden', theme.card)} aria-label="Orders and escrow">
      <div className={cn('p-4 border-b space-y-3', theme.divider)}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className={cn('text-sm font-bold', theme.text)}>Orders and escrow</h3>
            <p className={cn('text-xs mt-0.5', theme.muted)}>Records are kept, not deleted. Needs attention means disputed, or paid but not posted in time.</p>
          </div>
          <SearchBox placeholder="Item, buyer, seller, tracking or ID" onSearch={onSearch} isDarkMode={isDarkMode} />
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
          empty={view === 'attention' ? 'Nothing needs attention right now.' : 'No orders match.'}
          onRetry={reload}
          isDarkMode={isDarkMode}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={theme.head}>
              <tr>
                <th className="p-3 font-semibold">Order</th>
                <th className="p-3 font-semibold">Buyer and seller</th>
                <th className="p-3 font-semibold">Total</th>
                <th className="p-3 font-semibold">Status</th>
                <th className="p-3 font-semibold">Placed</th>
                <th className={cn('p-3 sticky right-0', theme.head)}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className={cn('divide-y', theme.divider)}>
              {rows.map((row) => (
                <tr key={row.id} className={theme.row}>
                  <td className="p-3 min-w-[200px]">
                    <p className={cn('font-semibold truncate max-w-[260px]', theme.text)}>{row.listingTitle || 'Untitled item'}</p>
                    <p className={theme.muted}>
                      {ref(row)}
                      {row.trackingNumber ? ` · ${row.trackingNumber}` : ''}
                    </p>
                    {row.postingOverdue ? (
                      <p className="inline-flex items-center gap-1 text-red-700 font-semibold">
                        <AlertTriangle className="w-3 h-3" aria-hidden="true" /> Posting overdue
                      </p>
                    ) : null}
                  </td>
                  <td className="p-3">
                    <p className={theme.text}><span className={theme.muted}>Buyer:</span> <span title={row.buyerEmail ?? undefined} className="font-medium">{row.buyerName}</span></p>
                    <p className={theme.text}><span className={theme.muted}>Seller:</span> <span title={row.sellerEmail ?? undefined} className="font-medium">{row.sellerName}</span></p>
                  </td>
                  <td className={cn('p-3 font-semibold whitespace-nowrap', theme.text)}>{amount(row)}</td>
                  <td className="p-3"><StatusBadge status={row.status} /></td>
                  <td className={cn('p-3 whitespace-nowrap', theme.muted)}>{shortDate(row.createdAt)}</td>
                  <td className={cn('p-3 sticky right-0', isDarkMode ? 'bg-neutral-900' : 'bg-white')}>
                    <div className="flex items-center justify-end gap-1.5">
                      <Link href={`/orders/${row.id}/tracking`} className={cn(ACTION_BUTTON, theme.button)} aria-label={`Open order ${ref(row)}`}>Open</Link>
                      {row.status === 'PENDING' ? (
                        <button type="button" onClick={() => cancel(row)} className={cn(ACTION_BUTTON, theme.danger)}>Cancel</button>
                      ) : null}
                      {row.status === 'DISPUTED' ? (
                        <button type="button" onClick={() => release(row)} className={cn(ACTION_BUTTON, theme.button)}>Pay seller</button>
                      ) : null}
                      {REFUNDABLE.includes(row.status) ? (
                        <button type="button" onClick={() => refund(row)} className={cn(ACTION_BUTTON, theme.danger)}>Refund</button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={total} limit={limit} onPage={setPage} isDarkMode={isDarkMode} />
      <ActionDialog action={pending} onClose={() => setPending(null)} onFailed={reload} isDarkMode={isDarkMode} />
    </section>
  );
}

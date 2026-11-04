'use client';

import { Copy, ExternalLink, RotateCcw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';
import { formatPrice } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { ListingPhoto } from './listing-photo';
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
  shortDateTime,
  StatusBadge,
  TableState,
  trustLabel,
  useDeskData,
} from './shared';

type ListingRow = {
  id: string;
  title: string;
  brand: string;
  model: string;
  price: number;
  currency: string;
  status: string;
  trustLensStatus: string;
  sellerName: string;
  sellerEmail: string | null;
  imageUrl: string | null;
  imeiEnding: string | null;
  serialEnding: string | null;
  possibleDuplicate: boolean;
  photoCount: number;
  createdAt: string;
};

const VIEWS = [
  { id: 'all', label: 'All current' },
  { id: 'live', label: 'Live' },
  { id: 'review', label: 'In review' },
  { id: 'duplicates', label: 'Possible duplicates' },
  { id: 'drafts', label: 'Drafts' },
  { id: 'reserved', label: 'Off sale or reserved' },
  { id: 'sold', label: 'Sold' },
  { id: 'removed', label: 'Taken down or rejected' },
];

const NOT_REMOVABLE = ['SOLD', 'DELISTED', 'REJECTED', 'AUCTION_ENDED'];

export function ListingsDesk({ isDarkMode, onChanged, initialView = 'all' }: DeskProps & { initialView?: string }) {
  const theme = deskTheme(isDarkMode);
  const [view, setView] = useState(initialView);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const { rows, total, counts, limit, loading, error, reload } = useDeskData<ListingRow>('listings', { view, search, page: String(page), limit: '25' });

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

  const takeDown = (row: ListingRow) =>
    setPending({
      title: 'Take this listing down?',
      body: `“${row.title}” leaves the marketplace straight away, and ${row.sellerName} is told why by email.`,
      confirmLabel: 'Take down',
      danger: true,
      reasonLabel: 'Reason, sent to the seller',
      run: async (reason) => {
        await sendAction(`/api/admin/listings/${row.id}/status`, 'PATCH', { status: 'DELISTED', reason });
        await finish(`“${row.title}” was taken down.`);
      },
    });

  const restore = (row: ListingRow) =>
    setPending({
      title: 'Put this listing back on sale?',
      body: `“${row.title}” goes live on the marketplace again.`,
      confirmLabel: 'Put back on sale',
      run: async () => {
        await sendAction(`/api/admin/listings/${row.id}/status`, 'PATCH', { status: 'ACTIVE' });
        await finish(`“${row.title}” is live again.`);
      },
    });

  return (
    <section className={cn('border rounded-2xl overflow-hidden', theme.card)} aria-label="Listings">
      <div className={cn('p-4 border-b space-y-3', theme.divider)}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className={cn('text-sm font-bold', theme.text)}>Listings</h3>
            <p className={cn('text-xs mt-0.5', theme.muted)}>Possible duplicates are open listings with the same IMEI or serial, or the same title from one seller.</p>
          </div>
          <SearchBox placeholder="Title, seller, IMEI, serial or ID" onSearch={onSearch} isDarkMode={isDarkMode} />
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
        <TableState loading={loading} error={error} empty="No listings match." onRetry={reload} isDarkMode={isDarkMode} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={theme.head}>
              <tr>
                <th className="p-3 font-semibold">Device</th>
                <th className="p-3 font-semibold">Seller</th>
                <th className="p-3 font-semibold">Price</th>
                <th className="p-3 font-semibold">Status</th>
                <th className={cn('p-3 sticky right-0', theme.head)}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className={cn('divide-y', theme.divider)}>
              {rows.map((row) => (
                <tr key={row.id} className={theme.row}>
                  <td className="p-3">
                    <div className="flex items-center gap-3 min-w-[240px]">
                      <ListingPhoto url={row.imageUrl} />
                      <div className="min-w-0">
                        <p className={cn('font-semibold truncate max-w-[280px]', theme.text)}>{row.title}</p>
                        <p className={theme.muted}>
                          {row.id.slice(0, 8)} · {shortDateTime(row.createdAt)}
                          {row.imeiEnding ? ` · IMEI ${row.imeiEnding}` : row.serialEnding ? ` · Serial ${row.serialEnding}` : ''}
                        </p>
                        {row.photoCount === 0 ? <p className="text-amber-700 font-semibold">No photos</p> : null}
                        {row.possibleDuplicate ? (
                          <p className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                            <Copy className="w-3 h-3" aria-hidden="true" /> Possible duplicate
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <p title={row.sellerEmail ?? undefined} className={cn('font-medium whitespace-nowrap', theme.text)}>{row.sellerName}</p>
                  </td>
                  <td className={cn('p-3 font-semibold whitespace-nowrap', theme.text)}>{formatPrice(row.price, row.currency)}</td>
                  <td className="p-3 whitespace-nowrap">
                    <StatusBadge status={row.status} />
                    {/* A check that never ran doesn't matter once the listing is gone. */}
                    {row.trustLensStatus === 'PENDING' && NOT_REMOVABLE.includes(row.status) ? null : (
                      <p className={cn('mt-1', theme.muted)}>{trustLabel(row.trustLensStatus)}</p>
                    )}
                  </td>
                  <td className={cn('p-3 sticky right-0', isDarkMode ? 'bg-neutral-900' : 'bg-white')}>
                    <div className="flex items-center justify-end gap-1.5">
                      {['SUBMITTED', 'UNDER_REVIEW'].includes(row.status) || row.trustLensStatus === 'REQUIRES_REVIEW' ? (
                        !NOT_REMOVABLE.includes(row.status) ? (
                          <Link href={`/admin/review/${row.id}`} className={cn(ACTION_BUTTON, 'bg-emerald-700 border-emerald-700 text-white hover:bg-emerald-800')}>Review</Link>
                        ) : null
                      ) : null}
                      <Link href={`/listings/${row.id}`} className={cn(ACTION_BUTTON, theme.button)} aria-label={`View ${row.title}`}>
                        <ExternalLink className="w-3 h-3" aria-hidden="true" /> View
                      </Link>
                      {!NOT_REMOVABLE.includes(row.status) ? (
                        <button type="button" onClick={() => takeDown(row)} className={cn(ACTION_BUTTON, theme.danger)}>
                          <Trash2 className="w-3 h-3" aria-hidden="true" /> Take down
                        </button>
                      ) : null}
                      {/* Going live counts as passing verification, so only a device that already passed can skip review. */}
                      {['DELISTED', 'INACTIVE'].includes(row.status) && row.trustLensStatus === 'PASSED' ? (
                        <button type="button" onClick={() => restore(row)} className={cn(ACTION_BUTTON, theme.button)}>
                          <RotateCcw className="w-3 h-3" aria-hidden="true" /> Put back
                        </button>
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

'use client';

import { Copy, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { formatPrice } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { ListingPhoto } from './listing-photo';
import { ageOf, deskTheme, DeskProps, flagLabel, Pager, StatusBadge, TableState, trustLabel, useDeskData } from './shared';

type QueueRow = {
  id: string;
  title: string;
  brand: string;
  model: string;
  price: number;
  currency: string;
  status: string;
  trustLensStatus: string;
  integrityFlags: string[];
  sellerName: string;
  sellerEmail: string | null;
  imageUrl: string | null;
  photoCount: number;
  imeiEnding: string | null;
  serialEnding: string | null;
  possibleDuplicate: boolean;
  createdAt: string;
};

/** Everything waiting on a reviewer, one row per listing, longest wait first. */
export function ReviewQueue({ isDarkMode }: DeskProps) {
  const theme = deskTheme(isDarkMode);
  const [page, setPage] = useState(1);
  const { rows, total, limit, loading, error, reload } = useDeskData<QueueRow>('review-queue', { page: String(page), limit: '25' });

  return (
    <section className={cn('border rounded-2xl overflow-hidden', theme.card)} aria-label="Review queue">
      <div className={cn('p-4 border-b', theme.divider)}>
        <h3 className={cn('text-sm font-bold', theme.text)}>Waiting for review ({total})</h3>
        <p className={cn('text-xs mt-0.5', theme.muted)}>Longest wait first. Sold and taken down listings drop off automatically.</p>
      </div>
      {rows.length === 0 ? (
        <TableState loading={loading} error={error} empty="Nothing is waiting for review." onRetry={reload} isDarkMode={isDarkMode} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={theme.head}>
              <tr>
                <th className="p-3 font-semibold">Device</th>
                <th className="p-3 font-semibold">Seller</th>
                <th className="p-3 font-semibold">Evidence</th>
                <th className="p-3 font-semibold">Problems</th>
                <th className="p-3 font-semibold">Waiting</th>
                <th className="p-3 font-semibold text-right"><span className="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody className={cn('divide-y', theme.divider)}>
              {rows.map((row) => {
                const problems = row.integrityFlags.filter((flag) => flag !== 'CLEAN');
                return (
                  <tr key={row.id} className={theme.row}>
                    <td className="p-3">
                      <div className="flex items-center gap-3 min-w-[220px]">
                        <ListingPhoto url={row.imageUrl} />
                        <div className="min-w-0">
                          <p className={cn('font-semibold truncate max-w-[260px]', theme.text)}>{row.title}</p>
                          <p className={theme.muted}>{formatPrice(row.price, row.currency)} · <StatusBadge status={row.status} /></p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <p className={cn('font-medium', theme.text)}>{row.sellerName}</p>
                      <p className={theme.muted}>{row.sellerEmail}</p>
                    </td>
                    <td className={cn('p-3 whitespace-nowrap', theme.muted)}>
                      <p>{row.photoCount} {row.photoCount === 1 ? 'photo' : 'photos'}</p>
                      <p>{row.imeiEnding ? `IMEI ${row.imeiEnding}` : row.serialEnding ? `Serial ${row.serialEnding}` : 'No identifier'}</p>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        <span className={theme.muted}>{trustLabel(row.trustLensStatus)}</span>
                        {problems.map((flag) => (
                          <span key={flag} className="inline-flex items-center gap-1 text-red-700 font-semibold">
                            <ShieldAlert className="w-3 h-3" aria-hidden="true" /> {flagLabel(flag)}
                          </span>
                        ))}
                        {row.possibleDuplicate ? (
                          <span className="inline-flex items-center gap-1 text-amber-700 font-semibold">
                            <Copy className="w-3 h-3" aria-hidden="true" /> Possible duplicate
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className={cn('p-3 font-semibold whitespace-nowrap', theme.text)}>{ageOf(row.createdAt)}</td>
                    <td className="p-3 text-right">
                      <Link href={`/admin/review/${row.id}`} className="inline-block px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold whitespace-nowrap">
                        Review
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} total={total} limit={limit} onPage={setPage} isDarkMode={isDarkMode} />
    </section>
  );
}

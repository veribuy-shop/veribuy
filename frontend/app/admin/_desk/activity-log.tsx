'use client';

import Link from 'next/link';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { deskTheme, DeskProps, Pager, TableState, useDeskData } from './shared';

type LogRow = {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  note: string | null;
  createdAt: string;
  admin: { name: string; email: string } | null;
};

function targetHref(row: LogRow): string | null {
  if (!row.targetId) return null;
  if (row.targetType === 'listing') return `/listings/${row.targetId}`;
  if (row.targetType === 'order') return `/orders/${row.targetId}/tracking`;
  return null;
}

/** A record of who did what. It can't be edited from here. */
export function ActivityLog({ isDarkMode }: DeskProps) {
  const theme = deskTheme(isDarkMode);
  const [page, setPage] = useState(1);
  const { rows, total, limit, loading, error, reload } = useDeskData<LogRow>('audit-log', { page: String(page), limit: '50' });

  return (
    <section className={cn('border rounded-2xl overflow-hidden', theme.card)} aria-label="Activity log">
      <div className={cn('p-4 border-b', theme.divider)}>
        <h3 className={cn('text-sm font-bold', theme.text)}>Activity log</h3>
        <p className={cn('text-xs mt-0.5', theme.muted)}>Every moderation, refund and user change made by an admin, newest first.</p>
      </div>
      {rows.length === 0 ? (
        <TableState loading={loading} error={error} empty="No admin actions recorded yet." onRetry={reload} isDarkMode={isDarkMode} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={theme.head}>
              <tr>
                <th className="p-3 font-semibold">When</th>
                <th className="p-3 font-semibold">Admin</th>
                <th className="p-3 font-semibold">Action</th>
                <th className="p-3 font-semibold">Item</th>
                <th className="p-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className={cn('divide-y', theme.divider)}>
              {rows.map((row) => {
                const href = targetHref(row);
                const label = row.targetId ? `${row.targetType} ${row.targetId.slice(0, 8)}` : row.targetType;
                return (
                  <tr key={row.id} className={theme.row}>
                    <td className={cn('p-3 whitespace-nowrap', theme.muted)}>
                      {new Date(row.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td className={cn('p-3 font-medium whitespace-nowrap', theme.text)}>{row.admin?.name ?? 'Removed admin'}</td>
                    <td className={cn('p-3 font-semibold whitespace-nowrap', theme.text)}>{row.action}</td>
                    <td className="p-3 whitespace-nowrap">
                      {href ? <Link href={href} className="text-emerald-700 font-semibold hover:underline">{label}</Link> : <span className={theme.muted}>{label}</span>}
                    </td>
                    <td className={cn('p-3', theme.muted)}>{row.note ?? '—'}</td>
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

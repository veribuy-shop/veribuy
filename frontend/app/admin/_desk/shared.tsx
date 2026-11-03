'use client';

import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Search, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export type DeskProps = { isDarkMode: boolean; onChanged?: () => void };

export function deskTheme(dark: boolean) {
  return {
    card: dark ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200',
    text: dark ? 'text-white' : 'text-slate-900',
    muted: dark ? 'text-neutral-400' : 'text-slate-500',
    divider: dark ? 'border-neutral-800' : 'border-slate-200',
    head: dark ? 'bg-neutral-950/40 text-neutral-400' : 'bg-slate-50 text-slate-500',
    row: dark ? 'hover:bg-neutral-800/40' : 'hover:bg-slate-50/70',
    input: dark
      ? 'bg-neutral-950 border-neutral-800 text-white placeholder-neutral-500'
      : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400',
    button: dark
      ? 'bg-neutral-800 border-neutral-700 text-neutral-200 hover:bg-neutral-700'
      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
    danger: dark
      ? 'bg-red-950/40 border-red-900 text-red-300 hover:bg-red-950/70'
      : 'bg-white border-red-200 text-red-700 hover:bg-red-50',
    surface: dark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-slate-200',
  };
}

export const ACTION_BUTTON = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap disabled:opacity-50';

export type NoticeState = { type: 'success' | 'error'; text: string } | null;

/** A message about the last action. Successes clear themselves, errors stay until dismissed or replaced. */
export function Notice({ notice, onDismiss }: { notice: NoticeState; onDismiss: () => void }) {
  useEffect(() => {
    if (notice?.type !== 'success') return;
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [notice, onDismiss]);

  if (!notice) return null;
  const success = notice.type === 'success';
  return (
    <div
      role={success ? 'status' : 'alert'}
      className={cn(
        'p-3 rounded-xl text-xs font-semibold flex items-center gap-2 mb-4 border',
        success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800',
      )}
    >
      {success ? <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" /> : <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />}
      <span className="flex-1">{notice.text}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss message" className="p-0.5 rounded hover:bg-black/5">
        <X className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}

const STATUS_TONES: Record<string, { label: string; tone: string }> = {
  ACTIVE: { label: 'Live', tone: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  DRAFT: { label: 'Draft', tone: 'bg-slate-100 text-slate-700 border-slate-200' },
  SUBMITTED: { label: 'Submitted', tone: 'bg-amber-50 text-amber-800 border-amber-200' },
  UNDER_REVIEW: { label: 'In review', tone: 'bg-amber-50 text-amber-800 border-amber-200' },
  APPROVED: { label: 'Approved', tone: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  REJECTED: { label: 'Rejected', tone: 'bg-red-50 text-red-800 border-red-200' },
  INACTIVE: { label: 'Off sale', tone: 'bg-slate-100 text-slate-700 border-slate-200' },
  AUCTION_ENDED: { label: 'Auction ended', tone: 'bg-blue-50 text-blue-800 border-blue-200' },
  DELISTED: { label: 'Taken down', tone: 'bg-red-50 text-red-800 border-red-200' },
  SOLD: { label: 'Sold', tone: 'bg-blue-50 text-blue-800 border-blue-200' },
  PENDING: { label: 'Not paid', tone: 'bg-slate-100 text-slate-700 border-slate-200' },
  PAYMENT_RECEIVED: { label: 'Paid', tone: 'bg-amber-50 text-amber-800 border-amber-200' },
  ESCROW_HELD: { label: 'Held, to post', tone: 'bg-amber-50 text-amber-800 border-amber-200' },
  SHIPPED: { label: 'Posted', tone: 'bg-blue-50 text-blue-800 border-blue-200' },
  DELIVERED: { label: 'Delivered', tone: 'bg-blue-50 text-blue-800 border-blue-200' },
  COMPLETED: { label: 'Completed', tone: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  DISPUTED: { label: 'Disputed', tone: 'bg-red-50 text-red-800 border-red-200' },
  REFUNDED: { label: 'Refunded', tone: 'bg-slate-100 text-slate-700 border-slate-200' },
  CANCELLED: { label: 'Cancelled', tone: 'bg-slate-100 text-slate-700 border-slate-200' },
};

export function StatusBadge({ status }: { status: string }) {
  const known = STATUS_TONES[status];
  return (
    <span className={cn('inline-block px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap', known?.tone ?? 'bg-slate-100 text-slate-700 border-slate-200')}>
      {known?.label ?? status.replace(/_/g, ' ').toLowerCase()}
    </span>
  );
}

const TRUST_LABELS: Record<string, string> = {
  PENDING: 'Check pending',
  IN_PROGRESS: 'Check running',
  PASSED: 'Verified',
  FAILED: 'Failed check',
  REQUIRES_REVIEW: 'Needs review',
};
export const trustLabel = (status: string) => TRUST_LABELS[status] ?? status;

const FLAG_LABELS: Record<string, string> = {
  IMEI_MISMATCH: 'IMEI mismatch',
  ICLOUD_LOCKED: 'iCloud locked',
  REPORTED_STOLEN: 'Reported stolen',
  BLACKLISTED: 'Blacklisted',
  SERIAL_MISMATCH: 'Serial mismatch',
  DUPLICATE_IMEI: 'IMEI used by another seller',
};
export const flagLabel = (flag: string) => FLAG_LABELS[flag] ?? flag;

/** How long ago, in the units a reviewer cares about. */
export function ageOf(date: string | Date, now = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - new Date(date).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

export const shortDate = (date: string | Date) =>
  new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

type Paged<T> = { data: T[]; total: number; page: number; limit: number; counts?: Record<string, number> };

/** Loads a page from the admin API. A newer request always beats a slower older one. */
export function useDeskData<T>(path: string, params: Record<string, string>) {
  const [result, setResult] = useState<Paged<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const latest = useRef(0);
  const query = new URLSearchParams(params).toString();

  const reload = useCallback(async () => {
    const request = ++latest.current;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/desk/${path}?${query}`, { credentials: 'include' });
      const body = await response.json().catch(() => null);
      if (request !== latest.current) return;
      if (!response.ok) throw new Error(body?.error || 'We could not load this.');
      setResult(body);
      setError('');
    } catch (err) {
      if (request === latest.current) setError(err instanceof Error ? err.message : 'We could not load this.');
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, [path, query]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { rows: result?.data ?? [], total: result?.total ?? 0, counts: result?.counts ?? {}, limit: result?.limit ?? 25, loading, error, reload };
}

export function FilterChips({
  views,
  active,
  counts,
  onSelect,
  isDarkMode,
}: {
  views: { id: string; label: string }[];
  active: string;
  counts: Record<string, number>;
  onSelect: (id: string) => void;
  isDarkMode: boolean;
}) {
  const theme = deskTheme(isDarkMode);
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter">
      {views.map((view) => {
        const selected = view.id === active;
        return (
          <button
            key={view.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(view.id)}
            className={cn(
              'px-2.5 py-1 rounded-lg border text-xs font-semibold whitespace-nowrap',
              selected ? 'bg-slate-900 border-slate-900 text-white' : theme.button,
            )}
          >
            {view.label}
            {counts[view.id] !== undefined ? <span className="ml-1.5 opacity-70">{counts[view.id]}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function SearchBox({
  placeholder,
  onSearch,
  isDarkMode,
}: {
  placeholder: string;
  onSearch: (term: string) => void;
  isDarkMode: boolean;
}) {
  const [value, setValue] = useState('');
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const timer = setTimeout(() => onSearch(value.trim()), 300);
    return () => clearTimeout(timer);
  }, [value, onSearch]);

  return (
    <div className="relative w-full sm:w-72">
      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn('w-full border rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-emerald-500', deskTheme(isDarkMode).input)}
      />
    </div>
  );
}

export function Pager({
  page,
  total,
  limit,
  onPage,
  isDarkMode,
}: {
  page: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
  isDarkMode: boolean;
}) {
  const theme = deskTheme(isDarkMode);
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className={cn('px-4 py-3 border-t flex items-center justify-between text-xs', theme.divider, theme.muted)}>
      <span>{total === 0 ? 'Nothing to show' : `${(page - 1) * limit + 1}–${Math.min(page * limit, total)} of ${total}`}</span>
      {pages > 1 ? (
        <div className="flex items-center gap-1">
          <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page" className={cn(ACTION_BUTTON, theme.button)}>
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <span className="px-2">Page {page} of {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page" className={cn(ACTION_BUTTON, theme.button)}>
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function TableState({ loading, error, empty, onRetry, isDarkMode }: { loading: boolean; error: string; empty: string; onRetry: () => void; isDarkMode: boolean }) {
  const theme = deskTheme(isDarkMode);
  if (error) {
    return (
      <div className="p-8 text-center text-sm" role="alert">
        <p className="text-red-700 mb-3">{error}</p>
        <button type="button" onClick={onRetry} className={cn(ACTION_BUTTON, theme.button)}>Try again</button>
      </div>
    );
  }
  if (loading) {
    return (
      <div className={cn('p-8 flex items-center justify-center gap-2 text-sm', theme.muted)} role="status">
        <Loader2 className="w-4 h-4 motion-safe:animate-spin" aria-hidden="true" /> Loading…
      </div>
    );
  }
  return <p className={cn('p-8 text-center text-sm', theme.muted)}>{empty}</p>;
}

export type PendingAction = {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  /** Set when the action needs a written reason, shown here as the field's label. */
  reasonLabel?: string;
  run: (reason: string) => Promise<void>;
};

/** Confirms an action and collects its reason. Failures stay in the dialog so the context isn't lost. */
export function ActionDialog({ action, onClose, onFailed, isDarkMode }: { action: PendingAction | null; onClose: () => void; onFailed?: () => void; isDarkMode: boolean }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const theme = deskTheme(isDarkMode);

  useEffect(() => {
    setReason('');
    setError('');
    setBusy(false);
  }, [action]);

  useEffect(() => {
    if (!action) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [action, busy, onClose]);

  if (!action) return null;
  const needsReason = !!action.reasonLabel;
  const confirm = async () => {
    if (needsReason && reason.trim().length < 5) {
      setError('Please give a short reason.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await action.run(reason.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work. Please try again.');
      setBusy(false);
      // The usual cause is the record having changed, so show what's true now.
      onFailed?.();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div role="dialog" aria-modal="true" aria-label={action.title} className={cn('w-full max-w-md rounded-2xl border p-5 shadow-xl', theme.surface)}>
        <h3 className={cn('text-base font-bold mb-1', theme.text)}>{action.title}</h3>
        <p className={cn('text-sm mb-4 leading-relaxed', theme.muted)}>{action.body}</p>
        {needsReason ? (
          <div className="mb-4">
            <label htmlFor="action-reason" className={cn('block text-xs font-semibold mb-1.5', theme.text)}>{action.reasonLabel}</label>
            <textarea
              id="action-reason"
              autoFocus
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError('');
              }}
              className={cn('w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500', theme.input)}
            />
          </div>
        ) : null}
        {error ? <p role="alert" className="text-sm text-red-700 mb-3">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose} className={cn('px-4 py-2 rounded-lg border text-sm font-semibold', theme.button)}>
            Keep as it is
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={confirm}
            className={cn('px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60', action.danger ? 'bg-red-700 hover:bg-red-800' : 'bg-emerald-700 hover:bg-emerald-800')}
          >
            {busy ? 'Working…' : action.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Sends an admin action, turning a refusal into the server's own explanation. */
export async function sendAction(url: string, method: string, body?: unknown): Promise<void> {
  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || data?.message || 'That did not work. Please try again.');
  }
}

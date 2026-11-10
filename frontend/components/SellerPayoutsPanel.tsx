'use client';

import { AlertCircle, Building2, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { formatPrice } from '@/lib/currency';
import { cn } from '@/lib/utils';

type AccountStatus = { connected: boolean; detailsSubmitted: boolean; payoutsEnabled: boolean };
type PayoutRow = {
  id: string;
  orderId: string;
  listingTitle: string | null;
  amount: number;
  currency: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
};

const PAYOUT_LABELS: Record<string, { label: string; tone: string }> = {
  PAID: { label: 'Paid', tone: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  AWAITING_SELLER: { label: 'Waiting for your bank details', tone: 'bg-amber-50 text-amber-800 border-amber-200' },
  PENDING: { label: 'Being sent', tone: 'bg-amber-50 text-amber-800 border-amber-200' },
  FAILED: { label: 'Being looked into', tone: 'bg-amber-50 text-amber-800 border-amber-200' },
  ON_HOLD: { label: 'On hold', tone: 'bg-red-50 text-red-800 border-red-200' },
  REVERSED: { label: 'Returned to buyer', tone: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

async function readJson<T>(url: string, method: 'GET' | 'POST' = 'GET'): Promise<T> {
  const response = await fetch(url, { method, credentials: 'include' });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || 'Something went wrong. Please try again.');
  return data as T;
}

/** Payout setup with Stripe, and the record of what has been paid for each sale. */
export function SellerPayoutsPanel({ isDarkMode }: { isDarkMode: boolean }) {
  const [account, setAccount] = useState<AccountStatus | null>(null);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // The account check also sends anything that was waiting, so history is read after it.
      setAccount(await readJson<AccountStatus>('/api/payouts/account'));
      setPayouts(await readJson<PayoutRow[]>('/api/payouts/history'));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not load your payout details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const open = async (action: 'onboarding-link' | 'dashboard-link') => {
    setOpening(true);
    setError('');
    try {
      const { url } = await readJson<{ url: string }>(`/api/payouts/${action}`, 'POST');
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not open the secure form. Please try again.');
      setOpening(false);
    }
  };

  const card = isDarkMode ? 'bg-neutral-900/70 border-neutral-800' : 'bg-white border-slate-200';
  const text = isDarkMode ? 'text-white' : 'text-slate-900';
  const muted = isDarkMode ? 'text-neutral-400' : 'text-slate-500';
  const inset = isDarkMode ? 'bg-neutral-950/60 border-neutral-800' : 'bg-slate-50 border-slate-200';

  const waiting = payouts.filter((payout) => payout.status === 'AWAITING_SELLER');
  const waitingTotal = waiting.reduce((sum, payout) => sum + payout.amount, 0);

  const state = !account
    ? null
    : account.payoutsEnabled
      ? {
          ready: true,
          title: 'Your bank details are set up',
          note: 'When a buyer confirms their order, your money is paid out and reaches your bank in a few working days.',
          button: 'Manage bank details',
          action: 'dashboard-link' as const,
        }
      : account.detailsSubmitted
        ? {
            ready: false,
            title: 'Your details are being checked',
            note: 'This usually takes a few minutes. If anything else is needed, continue to provide it.',
            button: 'Continue',
            action: 'onboarding-link' as const,
          }
        : {
            ready: false,
            title: account.connected ? 'Finish adding your bank details' : 'Add your bank details to get paid',
            note: 'A short secure form, handled by our payment provider Stripe: your name, date of birth, address and UK bank account. It takes a few minutes and VeriBuy never sees or stores your bank details.',
            button: account.connected ? 'Continue' : 'Add bank details',
            action: 'onboarding-link' as const,
          };

  return (
    <div className="space-y-6">
      <section className={cn('border rounded-3xl p-6 shadow-sm', card)} aria-label="Bank payout account">
        <h3 className={cn('text-base font-bold mb-4 flex items-center gap-2', text)}>
          <Building2 className="w-5 h-5 text-emerald-600" aria-hidden="true" /> Bank Payout Account
        </h3>
        {error ? (
          <p role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </p>
        ) : null}
        {loading && !account ? (
          <p className={cn('text-sm flex items-center gap-2', muted)}>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Checking your payout account
          </p>
        ) : state ? (
          <>
            {!state.ready && waitingTotal > 0 ? (
              <p className="mb-4 text-sm font-semibold text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                {formatPrice(waitingTotal, 'GBP')} is waiting for you. It is sent automatically once your bank details are added.
              </p>
            ) : null}
            <div className={cn('p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4', inset)}>
              <div className="flex items-start gap-3">
                {state.ready ? (
                  <CheckCircle2 className="w-5 h-5 mt-0.5 text-emerald-600 shrink-0" aria-hidden="true" />
                ) : (
                  <AlertCircle className="w-5 h-5 mt-0.5 text-amber-600 shrink-0" aria-hidden="true" />
                )}
                <div>
                  <p className={cn('text-sm font-bold', text)}>{state.title}</p>
                  <p className={cn('text-xs leading-relaxed mt-0.5 max-w-xl', muted)}>{state.note}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => open(state.action)}
                disabled={opening}
                className={cn(
                  'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap disabled:opacity-60',
                  state.ready
                    ? cn('border', isDarkMode ? 'border-neutral-700 text-neutral-200 hover:bg-neutral-800' : 'border-slate-300 text-slate-700 hover:bg-white')
                    : 'bg-emerald-600 text-white hover:bg-emerald-500',
                )}
              >
                {opening ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <ExternalLink className="w-4 h-4" aria-hidden="true" />}
                {state.button}
              </button>
            </div>
          </>
        ) : null}
      </section>

      <section className={cn('border rounded-3xl p-6 shadow-sm', card)} aria-label="Payout history">
        <h3 className={cn('text-base font-bold mb-4', text)}>Payout history</h3>
        {payouts.length === 0 ? (
          <p className={cn('text-sm', muted)}>
            {loading ? 'Loading' : 'No payouts yet. Each sale appears here once the buyer confirms their order.'}
          </p>
        ) : (
          <ul className={cn('divide-y', isDarkMode ? 'divide-neutral-800' : 'divide-slate-100')}>
            {payouts.map((payout) => {
              const badge = PAYOUT_LABELS[payout.status] ?? PAYOUT_LABELS.PENDING;
              return (
                <li key={payout.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className={cn('text-sm font-semibold truncate', text)}>{payout.listingTitle || 'Sold item'}</p>
                    <p className={cn('text-xs', muted)}>
                      Sale #{payout.orderId.substring(0, 8)} · {formatDate(payout.paidAt ?? payout.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={cn('px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap', badge.tone)}>
                      {badge.label}
                    </span>
                    <span className={cn('text-sm font-bold tabular-nums', text)}>{formatPrice(payout.amount, payout.currency)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

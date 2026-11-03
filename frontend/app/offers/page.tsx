'use client';

import { getMarketplaceConfig } from '@/lib/marketplace-config';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Tag, Check, X, Clock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { formatPrice } from '@/lib/currency';
import { buyerFacingPrice } from '@/lib/fees';

type OfferStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN' | 'EXPIRED' | 'COMPLETED';

interface Offer {
  id: string;
  listingId: string;
  amount: string | number;
  note: string | null;
  status: OfferStatus;
  expiresAt: string | null;
  createdAt: string;
  listing: { id: string; title: string; price: string | number; currency: string; status: string };
  buyer: { id: string; name: string };
  seller: { id: string; name: string };
}

const STATUS_STYLES: Record<OfferStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
  ACCEPTED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  DECLINED: 'bg-gray-100 text-gray-600 border-gray-200',
  WITHDRAWN: 'bg-gray-100 text-gray-600 border-gray-200',
  EXPIRED: 'bg-gray-100 text-gray-600 border-gray-200',
  COMPLETED: 'bg-blue-50 text-blue-800 border-blue-200',
};

export default function OffersPage() {
  const router = useRouter();
  const { user, loading: authLoading, authFetch } = useAuth();
  const [tab, setTab] = useState<'received' | 'sent'>('received');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch(`/api/offers?role=${tab === 'received' ? 'seller' : 'buyer'}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load offers');
      setOffers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load offers');
    } finally {
      setLoading(false);
    }
  }, [authFetch, tab]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login?redirect=/offers');
      return;
    }
    load();
  }, [authLoading, user, load, router]);

  const respond = async (offerId: string, action: 'ACCEPT' | 'DECLINE' | 'WITHDRAW') => {
    setBusyId(offerId);
    setError('');
    try {
      const res = await authFetch(`/api/offers/${offerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update offer');
      await load();
    } catch (err: any) {
      setError(err.message || 'Failed to update offer');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface)] py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center gap-2 mb-1">
          <Tag className="w-5 h-5 text-[var(--color-green)]" aria-hidden="true" />
          <h1 className="text-2xl font-bold text-[var(--color-text)]">Offers</h1>
        </div>
        <p className="text-sm text-[var(--color-text-muted)] mb-6">
          Accepted offers can be paid at the agreed price within {getMarketplaceConfig().offerPaymentWindowHours} hours. Buyer Protection and Royal Mail shipping are added at checkout.
        </p>

        <div className="flex gap-2 mb-6" role="tablist">
          {(['received', 'sent'] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border ${
                tab === t
                  ? 'bg-[var(--color-primary)] text-white border-transparent'
                  : 'bg-white text-[var(--color-text)] border-[var(--color-border)]'
              }`}
            >
              {t === 'received' ? 'Received (as seller)' : 'Sent (as buyer)'}
            </button>
          ))}
        </div>

        {error && (
          <div role="alert" className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-[var(--color-text-muted)]" role="status">Loading offers…</p>
        ) : offers.length === 0 ? (
          <div className="bg-white border border-[var(--color-border)] rounded-xl p-8 text-center text-sm text-[var(--color-text-muted)]">
            {tab === 'received' ? 'No offers on your listings yet.' : "You haven't made any offers yet."}
          </div>
        ) : (
          <ul className="space-y-3">
            {offers.map((offer) => {
              const amount = Number(offer.amount);
              const asking = Number(offer.listing.price);
              const isBusy = busyId === offer.id;
              return (
                <li key={offer.id} className="bg-white border border-[var(--color-border)] rounded-xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/listings/${offer.listingId}`} className="font-semibold text-[var(--color-text)] hover:underline">
                        {offer.listing.title}
                      </Link>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        Offer <strong className="text-[var(--color-text)]">{formatPrice(amount, 'GBP')}</strong> · asking{' '}
                        {formatPrice(asking, 'GBP')} ·{' '}
                        {tab === 'received' ? `from ${offer.buyer.name}` : `to ${offer.seller.name}`}
                      </p>
                      {offer.note && <p className="mt-1 text-xs text-[var(--color-text-muted)]">“{offer.note}”</p>}
                      {offer.status === 'ACCEPTED' && offer.expiresAt && (
                        <p className="mt-1 text-xs text-emerald-700 inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          Pay by {new Date(offer.expiresAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      )}
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${STATUS_STYLES[offer.status]}`}>
                      {offer.status.charAt(0) + offer.status.slice(1).toLowerCase()}
                    </span>
                  </div>

                  {tab === 'received' && offer.status === 'PENDING' && (
                    <div className="flex gap-2 mt-3">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => respond(offer.id, 'ACCEPT')}
                        className="inline-flex items-center gap-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-xl disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" aria-hidden="true" /> Accept
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => respond(offer.id, 'DECLINE')}
                        className="inline-flex items-center gap-1 px-4 py-2 border border-[var(--color-border)] text-sm font-semibold rounded-xl disabled:opacity-50"
                      >
                        <X className="w-4 h-4" aria-hidden="true" /> Decline
                      </button>
                    </div>
                  )}

                  {tab === 'sent' && offer.status === 'PENDING' && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => respond(offer.id, 'WITHDRAW')}
                      className="mt-3 px-4 py-2 border border-[var(--color-border)] text-sm font-semibold rounded-xl disabled:opacity-50"
                    >
                      Withdraw offer
                    </button>
                  )}

                  {tab === 'sent' && offer.status === 'ACCEPTED' && (
                    <Link
                      href={`/checkout?listingId=${offer.listingId}&offerId=${offer.id}`}
                      className="mt-3 inline-flex items-center px-4 py-2 bg-[var(--color-accent)] text-white text-sm font-semibold rounded-xl hover:opacity-90"
                    >
                      Pay {formatPrice(buyerFacingPrice(amount), 'GBP')} now (incl. Buyer Protection)
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

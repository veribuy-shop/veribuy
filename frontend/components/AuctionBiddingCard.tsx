'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { formatPrice } from '@/lib/currency';
import {
  formatAuctionCountdown,
  calculateMinimumNextBid,
  getBidIncrement,
  CountdownParts,
} from '@/lib/auction';
import {
  Gavel,
  Timer,
  Flame,
  CheckCircle2,
  AlertCircle,
  Clock,
  History,
  Lock,
  ArrowUpRight,
  ShieldCheck,
  X,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';

interface BidItem {
  id: string;
  bidder: string;
  amount: number;
  createdAt: string;
}

interface AuctionBiddingCardProps {
  listingId: string;
  sellerId: string;
  startingBid?: number | null;
  currentBid?: number | null;
  reservePrice?: number | null;
  buyItNowPrice?: number | null;
  bidCount?: number;
  highestBidderId?: string | null;
  auctionEndsAt?: string | null;
  currency?: string;
  trustLensPassed: boolean;
  onBidPlaced?: () => void;
}

export default function AuctionBiddingCard({
  listingId,
  sellerId,
  startingBid = 0.99,
  currentBid,
  reservePrice,
  buyItNowPrice,
  bidCount = 0,
  highestBidderId,
  auctionEndsAt,
  currency = 'GBP',
  trustLensPassed,
  onBidPlaced,
}: AuctionBiddingCardProps) {
  const router = useRouter();
  const { user } = useAuth();

  const [countdown, setCountdown] = useState<CountdownParts>(() =>
    formatAuctionCountdown(auctionEndsAt)
  );
  const [customBid, setCustomBid] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [bidHistory, setBidHistory] = useState<BidItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Live timer tick every 1 second
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(formatAuctionCountdown(auctionEndsAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [auctionEndsAt]);

  const numericStartingBid = startingBid ?? 0.99;
  const effectiveCurrentBid = currentBid ?? numericStartingBid;
  const minNextBid = calculateMinimumNextBid({
    startingBid: numericStartingBid,
    currentBid,
    highestBidderId,
    bidderId: user?.id,
  });

  const isSeller = user?.id === sellerId;
  const isHighestBidder = user?.id && highestBidderId && user.id === highestBidderId;
  const isAuctionEnded = countdown.isExpired;
  const isReserveMet = !reservePrice || effectiveCurrentBid >= reservePrice;

  // Preset bid amounts
  const presets = [
    minNextBid,
    Number((minNextBid + 5).toFixed(2)),
    Number((minNextBid + 15).toFixed(2)),
    Number((minNextBid + 30).toFixed(2)),
  ];

  const handleFetchHistory = async () => {
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/bids`);
      if (res.ok) {
        const data = await res.json();
        setBidHistory(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingHistory(false);
    }
  };

  const handlePlaceBid = async (amount: number) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!user) {
      router.push(`/login?redirect=/listings/${listingId}`);
      return;
    }

    if (isSeller) {
      setErrorMsg('You cannot bid on your own listing.');
      return;
    }

    if (amount < minNextBid) {
      setErrorMsg(`Bid must be at least ${formatPrice(minNextBid, currency)}.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxBid: amount }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to place bid');
        return;
      }

      if (data.isLeading) {
        setSuccessMsg(`You are currently the highest bidder at ${formatPrice(data.currentBid, currency)}!`);
      } else {
        setErrorMsg(`Another bidder had a higher maximum proxy bid. The current bid is now ${formatPrice(data.currentBid, currency)}.`);
      }

      setCustomBid('');
      if (onBidPlaced) onBidPlaced();
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred placing your bid');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-amber-200/80 shadow-md p-5 space-y-5 relative overflow-hidden">
      {/* Top Banner: Auction Status & Live Timer */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent -mx-5 -mt-5 p-4 border-b border-amber-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
            <Gavel className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-amber-950">Online Auction</span>
              {countdown.isAntiSnipingZone && !countdown.isExpired && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-red-600 text-white animate-pulse">
                  <Flame className="w-3 h-3" /> Soft-Close Extended
                </span>
              )}
            </div>
            <p className="text-[11px] text-amber-800/80">eBay-style Proxy Bidding</p>
          </div>
        </div>

        {/* Live Timer Pill */}
        <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 ${
          countdown.isExpired
            ? 'bg-gray-100 text-gray-700 border-gray-200'
            : countdown.isUrgent
            ? 'bg-red-50 text-red-700 border-red-200 animate-pulse'
            : 'bg-white text-gray-900 border-amber-200 shadow-2xs'
        }`}>
          <Clock className={`w-4 h-4 ${countdown.isUrgent && !countdown.isExpired ? 'text-red-600' : 'text-amber-600'}`} />
          <div className="text-right">
            <span className="block text-xs font-black leading-tight">{countdown.formatted}</span>
            <span className="block text-[9px] uppercase tracking-wider text-gray-500">
              {countdown.isExpired ? 'Ended' : 'Time Remaining'}
            </span>
          </div>
        </div>
      </div>

      {/* Current Bid & Bid Count Row */}
      <div className="flex items-baseline justify-between pt-1">
        <div>
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            {bidCount > 0 ? 'Current Bid' : 'Starting Bid'}
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-3xl sm:text-4xl font-black text-gray-950 tracking-tight">
              {formatPrice(effectiveCurrentBid, currency)}
            </span>
            {reservePrice && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                isReserveMet
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {isReserveMet ? 'Reserve Met' : 'Reserve Not Met'}
              </span>
            )}
          </div>
        </div>

        <div className="text-right">
          <button
            type="button"
            onClick={handleFetchHistory}
            className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
          >
            <History className="w-3.5 h-3.5" />
            <span>{bidCount} {bidCount === 1 ? 'bid' : 'bids'}</span>
          </button>
          <span className="block text-[11px] text-gray-400">
            Min bid: {formatPrice(minNextBid, currency)}
          </span>
        </div>
      </div>

      {/* Feedback Messages */}
      {errorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Leading Bidder Highlight */}
      {isHighestBidder && !countdown.isExpired && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-300 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-emerald-900">You are the highest bidder!</span>
          </div>
          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-600 text-white">
            Winning
          </span>
        </div>
      )}

      {/* Auction Controls / Bidding Section */}
      {!isAuctionEnded && (
        <div className="space-y-3">
          {/* Quick Presets */}
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1.5">
              Quick Bid Presets (Max Proxy)
            </span>
            <div className="grid grid-cols-4 gap-2">
              {presets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  disabled={submitting || isSeller}
                  onClick={() => handlePlaceBid(preset)}
                  className="py-2 px-1 rounded-xl border border-amber-200 hover:border-amber-400 bg-amber-50/50 hover:bg-amber-100/60 text-amber-950 font-bold text-xs text-center transition-all disabled:opacity-50 shadow-2xs"
                >
                  {formatPrice(preset, currency)}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Max Bid Input */}
          <div className="pt-1">
            <label htmlFor="custom-max-bid" className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
              Or Enter Your Maximum Bid (£)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">£</span>
                <input
                  id="custom-max-bid"
                  type="number"
                  step="0.01"
                  min={minNextBid}
                  value={customBid}
                  onChange={(e) => setCustomBid(e.target.value)}
                  placeholder={minNextBid.toFixed(2)}
                  disabled={submitting || isSeller}
                  className="w-full pl-7 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                />
              </div>
              <button
                type="button"
                disabled={submitting || isSeller || !customBid}
                onClick={() => handlePlaceBid(parseFloat(customBid))}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white rounded-xl font-black text-sm transition-all disabled:opacity-50 shadow-sm flex items-center justify-center gap-1.5"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Gavel className="w-4 h-4" />
                    <span>Place Bid</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-gray-500 mt-1.5">
              Proxy bidding automatically submits the minimum increment required to keep you leading, up to your max.
            </p>
          </div>

          {/* Optional Buy It Now Button */}
          {buyItNowPrice && buyItNowPrice > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-700">Don't want to wait?</span>
                <span className="text-sm font-black text-gray-900">
                  {formatPrice(buyItNowPrice, currency)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!user) {
                    router.push(`/login?redirect=/checkout?listingId=${listingId}`);
                    return;
                  }
                  router.push(`/checkout?listingId=${listingId}`);
                }}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Buy It Now with Escrow</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Auction Ended Banner */}
      {isAuctionEnded && (
        <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm text-gray-800">Auction Ended</span>
            <span className="text-xs font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-gray-200 text-gray-700">
              Closed
            </span>
          </div>

          {isHighestBidder && isReserveMet ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
              <p className="text-xs font-bold text-emerald-900">
                🎉 Congratulations! You won this auction at {formatPrice(effectiveCurrentBid, currency)}.
              </p>
              <button
                type="button"
                onClick={() => router.push(`/checkout?listingId=${listingId}`)}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs flex items-center justify-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Complete 48-Hour Escrow Checkout</span>
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-600">
              {bidCount === 0
                ? 'This auction ended with no bids.'
                : !isReserveMet
                ? 'This auction ended without meeting the seller’s reserve price.'
                : `Winning bid: ${formatPrice(effectiveCurrentBid, currency)}`}
            </p>
          )}
        </div>
      )}

      {/* Anti-sniping info badge */}
      <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
        <span className="flex items-center gap-1">
          <Timer className="w-3.5 h-3.5 text-amber-600" />
          Anti-Sniping Soft Close (+2 min)
        </span>
        <span className="flex items-center gap-1 text-emerald-700 font-semibold">
          <Lock className="w-3 h-3 text-emerald-600" />
          Escrow Protected
        </span>
      </div>

      {/* Bid History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base text-gray-900">Bid History</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {loadingHistory ? (
              <div className="py-8 text-center text-xs text-gray-400">Loading bid history...</div>
            ) : bidHistory.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-500">
                No bids have been placed yet. Be the first to bid!
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {bidHistory.map((bid, i) => (
                  <div
                    key={bid.id || i}
                    className={`flex items-center justify-between p-3 rounded-xl border text-xs ${
                      i === 0
                        ? 'bg-emerald-50/70 border-emerald-200 font-semibold text-emerald-950'
                        : 'bg-gray-50 border-gray-200/80 text-gray-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span>{bid.bidder}</span>
                        {i === 0 && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-emerald-600 text-white">
                            HIGH BIDDER
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400">
                        {new Date(bid.createdAt).toLocaleString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>
                    </div>
                    <span className="font-black text-sm">
                      {formatPrice(bid.amount, currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="text-center pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

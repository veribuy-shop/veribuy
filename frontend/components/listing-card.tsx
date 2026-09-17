import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, Truck, Gavel, Clock, Sparkles } from 'lucide-react';
import { formatPrice } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { formatAuctionCountdown } from '@/lib/auction';

export interface ListingCardProps {
  id: string;
  href: string;
  title: string;
  imageUrl?: string;
  imageFallbackIcon?: string;
  conditionGrade: 'A' | 'B' | 'C';
  conditionLabel: string;
  price: number;
  originalPrice?: number;
  currency?: string;
  verified?: boolean;
  brand?: string;
  model?: string;
  location?: string;
  format?: 'FIXED_PRICE' | 'AUCTION';
  currentBid?: number;
  startingBid?: number;
  bidsCount?: number;
  auctionEndTime?: string;
  buyItNowPrice?: number;
}

const GRADE_CONFIG = {
  A: { label: 'Grade A', sub: 'Pristine', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  B: { label: 'Grade B', sub: 'Good', className: 'bg-sky-100 text-sky-800 border-sky-200' },
  C: { label: 'Grade C', sub: 'Fair', className: 'bg-amber-100 text-amber-800 border-amber-200' },
} as const;

export function ListingCard({
  href,
  title,
  imageUrl,
  imageFallbackIcon,
  conditionGrade,
  conditionLabel,
  price,
  originalPrice,
  currency = 'GBP',
  verified = true,
  brand,
  model,
  location,
  format = 'FIXED_PRICE',
  currentBid,
  startingBid,
  bidsCount = 0,
  auctionEndTime,
  buyItNowPrice,
}: ListingCardProps) {
  const grade = GRADE_CONFIG[conditionGrade] || GRADE_CONFIG.A;
  const isAuction = format === 'AUCTION';

  const [timeLeft, setTimeLeft] = useState<{ formatted: string; isExpired: boolean; isUrgent: boolean } | null>(null);

  useEffect(() => {
    if (!isAuction || !auctionEndTime) return;

    const updateTime = () => {
      const parts = formatAuctionCountdown(auctionEndTime);
      setTimeLeft({
        formatted: parts.formatted,
        isExpired: parts.isExpired,
        isUrgent: parts.isUrgent,
      });
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, [isAuction, auctionEndTime]);

  const activePrice = isAuction
    ? (currentBid !== undefined && currentBid !== null && bidsCount > 0 ? currentBid : startingBid || price)
    : price;

  const savingsPercent = originalPrice && originalPrice > activePrice
    ? Math.round(((originalPrice - activePrice) / originalPrice) * 100)
    : null;

  return (
    <Link
      href={href}
      className={cn(
        'group relative bg-white rounded-xl border border-gray-200/90 overflow-hidden transition-all duration-150 flex flex-col h-full',
        isAuction ? 'hover:border-amber-500 hover:shadow-md' : 'hover:border-emerald-600 hover:shadow-md'
      )}
    >
      {/* Product Image Frame */}
      <div className="relative aspect-square bg-gray-50/70 p-3 flex items-center justify-center overflow-hidden border-b border-gray-100">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-contain p-2 transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-4xl" aria-hidden="true">
              {imageFallbackIcon || '📱'}
            </span>
          </div>
        )}

        {/* Verification Pill - top left */}
        {verified && (
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1 bg-white/95 backdrop-blur-xs border border-emerald-200 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md shadow-2xs">
            <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
            <span>Verified</span>
          </div>
        )}

        {/* Top Right: Auction Pill or Savings Badge */}
        {isAuction ? (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-xs">
            <Gavel className="w-3 h-3 shrink-0" />
            <span>Auction</span>
          </div>
        ) : (
          savingsPercent && savingsPercent > 0 && (
            <span className="absolute top-2.5 right-2.5 bg-gray-900 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-2xs">
              Save {savingsPercent}%
            </span>
          )
        )}

        {/* Bottom Banner for Live Auction Countdown */}
        {isAuction && timeLeft && (
          <div
            className={cn(
              'absolute bottom-0 inset-x-0 py-1 px-2.5 text-[10px] font-bold flex items-center justify-between backdrop-blur-md transition-colors',
              timeLeft.isExpired
                ? 'bg-gray-900/90 text-gray-200'
                : timeLeft.isUrgent
                ? 'bg-red-600/90 text-white animate-pulse'
                : 'bg-amber-950/80 text-amber-200'
            )}
          >
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 shrink-0" />
              <span>{timeLeft.isExpired ? 'Auction Ended' : `${timeLeft.formatted} left`}</span>
            </span>
            <span className="text-[9px] font-medium text-amber-100/90">
              {bidsCount} {bidsCount === 1 ? 'bid' : 'bids'}
            </span>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex flex-col flex-1 p-3.5 justify-between gap-2">
        <div>
          {/* Title */}
          <h3 className={cn(
            'font-semibold text-xs sm:text-sm text-gray-900 line-clamp-2 leading-snug transition-colors mb-1.5',
            isAuction ? 'group-hover:text-amber-700' : 'group-hover:text-emerald-700'
          )}>
            {title}
          </h3>

          {/* Condition & Spec Badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border', grade.className)}>
              {grade.label}
            </span>
            <span className="text-[11px] text-gray-500 font-medium truncate">
              {conditionLabel || (brand ? `${brand} ${model || ''}` : '')}
            </span>
          </div>
        </div>

        {/* Price & Auction/Shipping Info */}
        <div className="pt-2 border-t border-gray-100 mt-auto">
          {isAuction ? (
            <div>
              <div className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide">
                {bidsCount > 0 ? 'Current Bid' : 'Starting Bid'}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
                  {formatPrice(activePrice, currency)}
                </span>
                {buyItNowPrice && buyItNowPrice > activePrice && (
                  <span className="text-[11px] text-gray-500 font-medium truncate">
                    Buy Now: {formatPrice(buyItNowPrice, currency)}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-baseline gap-1.5">
              <span className="text-base sm:text-lg font-black text-gray-900 tracking-tight">
                {formatPrice(price, currency)}
              </span>
              {originalPrice && originalPrice > price && (
                <span className="text-xs text-gray-400 line-through">
                  {formatPrice(originalPrice, currency)}
                </span>
              )}
            </div>
          )}

          {/* Tracked shipping / location info */}
          <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1.5">
            <span className="flex items-center gap-1 text-emerald-700 font-medium">
              <Truck className="w-3 h-3" />
              Tracked
            </span>
            {location && (
              <span className="text-gray-400 truncate max-w-[110px]">
                {location}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

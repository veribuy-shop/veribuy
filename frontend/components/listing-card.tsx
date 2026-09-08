import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, Truck } from 'lucide-react';
import { formatPrice } from '@/lib/currency';
import { cn } from '@/lib/utils';

interface ListingCardProps {
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
}: ListingCardProps) {
  const grade = GRADE_CONFIG[conditionGrade] || GRADE_CONFIG.A;
  const savingsPercent = originalPrice && originalPrice > price
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : null;

  return (
    <Link
      href={href}
      className="group relative bg-white rounded-xl border border-gray-200/90 overflow-hidden hover:border-emerald-600 hover:shadow-md transition-all duration-150 flex flex-col h-full"
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

        {/* Savings Badge - top right */}
        {savingsPercent && savingsPercent > 0 && (
          <span className="absolute top-2.5 right-2.5 bg-gray-900 text-white text-[10px] font-black px-1.5 py-0.5 rounded-md shadow-2xs">
            Save {savingsPercent}%
          </span>
        )}
      </div>

      {/* Content Area */}
      <div className="flex flex-col flex-1 p-3.5 justify-between gap-2">
        <div>
          {/* Title */}
          <h3 className="font-semibold text-xs sm:text-sm text-gray-900 line-clamp-2 leading-snug group-hover:text-emerald-700 transition-colors mb-1.5">
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

        {/* Price & Shipping Info */}
        <div className="pt-2 border-t border-gray-100 mt-auto">
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

          {/* Tracked shipping / location info */}
          <div className="flex items-center justify-between text-[11px] text-gray-500 mt-1">
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

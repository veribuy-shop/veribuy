import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck } from 'lucide-react';
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
}

const GRADE_CONFIG = {
  A: { label: 'A', className: 'bg-[var(--color-green)] text-white' },
  B: { label: 'B', className: 'bg-sky-500 text-white' },
  C: { label: 'C', className: 'bg-amber-500 text-white' },
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
}: ListingCardProps) {
  const grade = GRADE_CONFIG[conditionGrade];
  const savingsPercent = originalPrice
    ? Math.round(((originalPrice - price) / originalPrice) * 100)
    : null;

  return (
    <Link
      href={href}
      className="group relative bg-white rounded-2xl border border-[var(--color-border)] overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-[var(--color-primary-light)] hover:-translate-y-0.5 flex flex-col h-full"
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-[var(--color-surface-alt)] overflow-hidden">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={title}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-5xl" aria-hidden="true">
              {imageFallbackIcon || '📦'}
            </span>
          </div>
        )}

        {/* Grade badge - top left */}
        <span
          className={cn(
            'absolute top-3 left-3 text-white text-xs font-bold px-2.5 py-1 rounded-lg',
            grade.className,
          )}
        >
          Grade {conditionGrade}
        </span>

        {/* Savings badge - top right */}
        {savingsPercent && savingsPercent > 0 && (
          <span className="absolute top-3 right-3 bg-[var(--color-primary)] text-white text-xs font-bold px-2.5 py-1 rounded-lg">
            Save {savingsPercent}%
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-3">
        {/* Verified + Grade row */}
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          {verified && (
            <div className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-green)]" aria-hidden="true" />
              <span className="text-xs font-semibold text-[var(--color-green)]">Verified</span>
            </div>
          )}
          <span
            className={cn(
              'text-xs font-bold px-1.5 py-0.5 rounded',
              grade.className,
            )}
          >
            {grade.label}
          </span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-sm leading-snug text-[var(--color-text)] line-clamp-2 mb-1 group-hover:text-[var(--color-primary)] transition-colors">
          {title}
        </h3>

        {/* Condition label */}
        <p className="text-xs text-[var(--color-text-muted)] mb-2">
          {conditionLabel}
        </p>

        {/* Price */}
        <div className="mt-auto">
          <span className="text-base font-bold text-[var(--color-text)]">
            {formatPrice(price, currency)}
          </span>
        </div>
      </div>
    </Link>
  );
}

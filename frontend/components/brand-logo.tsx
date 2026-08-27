import Image from 'next/image';
import { cn } from '@/lib/utils';

interface BrandLogoProps {
  className?: string;
  priority?: boolean;
}

export function BrandLogo({ className, priority = false }: BrandLogoProps) {
  return (
    <Image
      src="/veribuy-logo.png"
      alt="VeriBuy"
      width={512}
      height={279}
      priority={priority}
      className={cn('object-contain', className)}
    />
  );
}

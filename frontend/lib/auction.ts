/**
 * eBay-style UK bid increment tiers and countdown helpers for frontend
 */

export const BID_INCREMENT_TIERS = [
  { upTo: 0.99, increment: 0.05 },
  { upTo: 4.99, increment: 0.20 },
  { upTo: 14.99, increment: 0.50 },
  { upTo: 59.99, increment: 1.00 },
  { upTo: 99.99, increment: 2.00 },
  { upTo: 249.99, increment: 2.50 },
  { upTo: 499.99, increment: 5.00 },
  { upTo: 999.99, increment: 10.00 },
  { upTo: 2499.99, increment: 20.00 },
  { upTo: Infinity, increment: 25.00 },
] as const;

export function getBidIncrement(currentBid: number): number {
  if (currentBid < 0) return 0.05;
  for (const tier of BID_INCREMENT_TIERS) {
    if (currentBid <= tier.upTo) {
      return tier.increment;
    }
  }
  return 25.00;
}

export function calculateMinimumNextBid(params: {
  startingBid: number;
  currentBid?: number | null;
  highestBidderId?: string | null;
  bidderId?: string | null;
}): number {
  const { startingBid, currentBid, highestBidderId, bidderId } = params;

  if (currentBid == null || currentBid <= 0) {
    return startingBid > 0 ? startingBid : 0.99;
  }

  // If user is already the highest bidder, they can increase their proxy max at the current level
  if (bidderId && highestBidderId && bidderId === highestBidderId) {
    return currentBid;
  }

  const increment = getBidIncrement(currentBid);
  return Number((currentBid + increment).toFixed(2));
}

export interface CountdownParts {
  totalMs: number;
  isExpired: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  formatted: string;
  isUrgent: boolean; // < 1 hour
  isAntiSnipingZone: boolean; // < 2 mins
}

export function formatAuctionCountdown(endsAt: string | Date | null | undefined): CountdownParts {
  if (!endsAt) {
    return {
      totalMs: 0,
      isExpired: true,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      formatted: 'Auction Ended',
      isUrgent: false,
      isAntiSnipingZone: false,
    };
  }

  const target = typeof endsAt === 'string' ? new Date(endsAt).getTime() : endsAt.getTime();
  const now = Date.now();
  const totalMs = target - now;

  if (totalMs <= 0) {
    return {
      totalMs: 0,
      isExpired: true,
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      formatted: 'Auction Ended',
      isUrgent: false,
      isAntiSnipingZone: false,
    };
  }

  const seconds = Math.floor((totalMs / 1000) % 60);
  const minutes = Math.floor((totalMs / (1000 * 60)) % 60);
  const hours = Math.floor((totalMs / (1000 * 60 * 60)) % 24);
  const days = Math.floor(totalMs / (1000 * 60 * 60 * 24));

  let formatted: string;
  if (days > 0) {
    formatted = `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    formatted = `${hours}h ${minutes}m ${seconds}s`;
  } else {
    formatted = `${minutes}m ${seconds}s`;
  }

  return {
    totalMs,
    isExpired: false,
    days,
    hours,
    minutes,
    seconds,
    formatted,
    isUrgent: totalMs < 60 * 60 * 1000,
    isAntiSnipingZone: totalMs < 2 * 60 * 1000,
  };
}

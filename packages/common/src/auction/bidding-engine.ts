export type ListingFormat = 'FIXED_PRICE' | 'AUCTION';

export interface BidIncrementTier {
  minAmount: number;
  maxAmount: number;
  increment: number;
}

/**
 * Standard eBay UK Bid Increment Ladder.
 */
export const BID_INCREMENT_TIERS: BidIncrementTier[] = [
  { minAmount: 0.01, maxAmount: 4.99, increment: 0.20 },
  { minAmount: 5.00, maxAmount: 24.99, increment: 0.50 },
  { minAmount: 25.00, maxAmount: 99.99, increment: 1.00 },
  { minAmount: 100.00, maxAmount: 249.99, increment: 2.50 },
  { minAmount: 250.00, maxAmount: 499.99, increment: 5.00 },
  { minAmount: 500.00, maxAmount: 999.99, increment: 10.00 },
  { minAmount: 1000.00, maxAmount: Infinity, increment: 25.00 },
];

/**
 * Returns the standard minimum bid increment for a given current bid amount.
 */
export function getBidIncrement(currentAmount: number): number {
  const amt = Math.max(0, currentAmount);
  const tier = BID_INCREMENT_TIERS.find(
    (t) => amt >= t.minAmount && amt <= t.maxAmount,
  );
  return tier ? tier.increment : 1.00;
}

/**
 * Calculates the absolute minimum valid next bid a user can place.
 */
export function calculateMinimumNextBid(
  currentBid: number | null | undefined,
  startingBid: number | null | undefined,
  bidCount: number = 0,
): number {
  const start = startingBid && startingBid > 0 ? Number(startingBid) : 0.99;
  if (!currentBid || bidCount === 0) {
    return start;
  }
  const current = Number(currentBid);
  const increment = getBidIncrement(current);
  return Math.round((current + increment) * 100) / 100;
}

export interface ProxyBiddingInput {
  newBidderId: string;
  newMaxBid: number;
  currentBid: number | null | undefined;
  startingBid: number;
  reservePrice?: number | null;
  highestBidderId?: string | null;
  highestMaxBid?: number | null;
  bidCount: number;
}

export interface ProxyBiddingResult {
  leadingBidderId: string;
  currentBid: number;
  highestMaxBid: number;
  isNewLead: boolean;
  outbidBidderId?: string | null;
  reserveMet: boolean;
  bidPlacedAmount: number;
}

/**
 * Evaluates proxy bidding outcome when a new max bid is placed.
 */
export function calculateProxyBidOutcome(input: ProxyBiddingInput): ProxyBiddingResult {
  const {
    newBidderId,
    newMaxBid,
    currentBid,
    startingBid,
    reservePrice,
    highestBidderId,
    highestMaxBid,
    bidCount,
  } = input;

  const reserve = reservePrice && reservePrice > 0 ? Number(reservePrice) : 0;
  const start = startingBid > 0 ? Number(startingBid) : 0.99;

  // Case 1: First bid on the auction
  if (!highestBidderId || !highestMaxBid || bidCount === 0) {
    let resolvedBid = start;
    if (reserve > 0 && newMaxBid >= reserve) {
      // If reserve exists and new bid meets/exceeds reserve, start bid meets reserve if start < reserve
      resolvedBid = Math.max(start, Math.min(newMaxBid, reserve));
    }
    return {
      leadingBidderId: newBidderId,
      currentBid: Math.round(resolvedBid * 100) / 100,
      highestMaxBid: newMaxBid,
      isNewLead: true,
      outbidBidderId: null,
      reserveMet: reserve > 0 ? resolvedBid >= reserve : true,
      bidPlacedAmount: Math.round(resolvedBid * 100) / 100,
    };
  }

  // Case 2: Same high bidder increasing their maximum bid
  if (highestBidderId === newBidderId) {
    const updatedMax = Math.max(highestMaxBid, newMaxBid);
    let resolvedCurrent = currentBid ?? start;
    if (reserve > 0 && updatedMax >= reserve && resolvedCurrent < reserve) {
      resolvedCurrent = reserve;
    }
    return {
      leadingBidderId: newBidderId,
      currentBid: Math.round(resolvedCurrent * 100) / 100,
      highestMaxBid: updatedMax,
      isNewLead: true,
      outbidBidderId: null,
      reserveMet: reserve > 0 ? resolvedCurrent >= reserve : true,
      bidPlacedAmount: Math.round(resolvedCurrent * 100) / 100,
    };
  }

  // Case 3: Competing bidder placing a bid
  const prevLeader = highestBidderId;
  const prevMax = highestMaxBid;

  if (newMaxBid > prevMax) {
    // New bidder takes the lead.
    // Minimum price is previous high max + 1 standard increment (or newMaxBid if not enough)
    const increment = getBidIncrement(prevMax);
    let nextBid = Math.min(newMaxBid, prevMax + increment);

    if (reserve > 0 && newMaxBid >= reserve && nextBid < reserve) {
      nextBid = reserve;
    }

    return {
      leadingBidderId: newBidderId,
      currentBid: Math.round(nextBid * 100) / 100,
      highestMaxBid: newMaxBid,
      isNewLead: true,
      outbidBidderId: prevLeader,
      reserveMet: reserve > 0 ? nextBid >= reserve : true,
      bidPlacedAmount: Math.round(nextBid * 100) / 100,
    };
  } else {
    // Existing leader defends lead.
    // Existing leader's current bid increases to newMaxBid + 1 increment (up to their max)
    const increment = getBidIncrement(newMaxBid);
    let nextBid = Math.min(prevMax, newMaxBid + increment);

    if (reserve > 0 && prevMax >= reserve && nextBid < reserve) {
      nextBid = reserve;
    }

    return {
      leadingBidderId: prevLeader,
      currentBid: Math.round(nextBid * 100) / 100,
      highestMaxBid: prevMax,
      isNewLead: false,
      outbidBidderId: newBidderId,
      reserveMet: reserve > 0 ? nextBid >= reserve : true,
      bidPlacedAmount: Math.round(nextBid * 100) / 100,
    };
  }
}

/**
 * Anonymizes bidder usernames for public bid history display (e.g. "u***1" or "a***9").
 */
export function anonymizeBidderHandle(identifier: string): string {
  if (!identifier) return 'b***r';
  const clean = identifier.replace(/[^a-zA-Z0-9]/g, '');
  if (clean.length <= 2) return `${clean.charAt(0)}***`;
  const first = clean.charAt(0);
  const last = clean.charAt(clean.length - 1);
  return `${first}***${last}`;
}

/**
 * Formats seconds remaining into human-readable auction countdown.
 */
export function formatAuctionCountdown(endsAt: Date | string | null | undefined): {
  isEnded: boolean;
  isUrgent: boolean;
  formattedText: string;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  if (!endsAt) {
    return { isEnded: true, isUrgent: false, formattedText: 'Ended', days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  const endMs = new Date(endsAt).getTime();
  const nowMs = Date.now();
  const diffMs = endMs - nowMs;

  if (diffMs <= 0) {
    return { isEnded: true, isUrgent: false, formattedText: 'Auction Ended', days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  const totalSec = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  const isUrgent = diffMs < 3600000; // < 1 hour

  let formattedText = '';
  if (days > 0) {
    formattedText = `${days}d ${hours}h`;
  } else if (hours > 0) {
    formattedText = `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    formattedText = `${minutes}m ${seconds}s`;
  } else {
    formattedText = `${seconds}s`;
  }

  return {
    isEnded: false,
    isUrgent,
    formattedText,
    days,
    hours,
    minutes,
    seconds,
  };
}

import { describe, it, expect } from 'vitest';
import { calculateMinimumNextBid } from '@/lib/auction';

describe('calculateMinimumNextBid', () => {
  it('allows the first bid at the starting price even though currentBid is pre-filled', () => {
    expect(calculateMinimumNextBid({ startingBid: 100, currentBid: 100, bidCount: 0 })).toBe(100);
  });

  it('requires an increment above the current bid once bidding has started', () => {
    expect(calculateMinimumNextBid({ startingBid: 100, currentBid: 100, bidCount: 1, bidderId: 'b', highestBidderId: 'a' })).toBeGreaterThan(100);
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getBuyerProtectionFeePercent,
  getBuyerProtectionFeeRate,
  calculateProtectionFee,
  buyerFacingPrice,
} from '../fees';
import { setMarketplaceConfig, parseMarketplaceConfig } from '../marketplace-config';

const setFee = (buyerProtectionFeePercent: number) =>
  setMarketplaceConfig({
    buyerProtectionFeePercent,
    checkoutHoldMinutes: 45,
    auctionPaymentWindowHours: 48,
    offerPaymentWindowHours: 48,
    charityDonationGbp: 1,
  });

describe('Fee calculation utilities', () => {
  it('should show no fee until the server has reported its rate', async () => {
    vi.resetModules();
    const fresh = await import('../marketplace-config');
    expect(fresh.isMarketplaceConfigKnown()).toBe(false);
    expect(fresh.getMarketplaceConfig().buyerProtectionFeePercent).toBe(0);
  });

  it('should calculate accurate protection fees with 2 decimal precision', () => {
    setFee(5);
    expect(calculateProtectionFee(100)).toBe(5);
    expect(calculateProtectionFee(500)).toBe(25);
    expect(calculateProtectionFee(349.99)).toBe(17.5);
    expect(calculateProtectionFee(0)).toBe(0);
  });

  it('should follow whatever rate the server reports, including decimals', () => {
    setFee(8);
    expect(getBuyerProtectionFeePercent()).toBe(8);
    expect(getBuyerProtectionFeeRate()).toBe(0.08);
    expect(calculateProtectionFee(100)).toBe(8);

    setFee(2.5);
    expect(getBuyerProtectionFeePercent()).toBe(2.5);
    expect(calculateProtectionFee(100)).toBe(2.5);
  });

  // SECURITY REGRESSION: the fee rate must never be sourced from client-writable
  // storage. A tampered localStorage value must have no effect on the rate.
  it('ignores a tampered localStorage override', () => {
    const store: Record<string, string> = {
      veribuy_buyer_protection_fee_percent: '0',
    };
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
    });

    setFee(5);

    expect(getBuyerProtectionFeePercent()).toBe(5);
    expect(calculateProtectionFee(200)).toBe(10);

    vi.unstubAllGlobals();
  });
});

describe('buyerFacingPrice', () => {
  beforeEach(() => {
    setFee(5);
  });

  it('adds the buyer protection fee to the seller price (shipping excluded)', () => {
    expect(buyerFacingPrice(120)).toBe(126);
    expect(buyerFacingPrice(749.99)).toBe(787.49);
  });
});

describe('parseMarketplaceConfig', () => {
  it('rejects an incomplete answer rather than filling in values', () => {
    expect(parseMarketplaceConfig({ buyerProtectionFeePercent: 5 })).toBeNull();
    expect(parseMarketplaceConfig(null)).toBeNull();
  });
});

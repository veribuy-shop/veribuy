import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getBuyerProtectionFeePercent,
  getBuyerProtectionFeeRate,
  calculateProtectionFee,
} from '../fees';

describe('Fee calculation utilities', () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_BUYER_PROTECTION_FEE_PERCENT;
    delete process.env.NEXT_PUBLIC_BUYER_PROTECTION_FEE_RATE;
    delete process.env.BUYER_PROTECTION_FEE_PERCENT;
  });

  it('should default to 5% when no environment variable or override is provided', () => {
    expect(getBuyerProtectionFeePercent()).toBe(5);
    expect(getBuyerProtectionFeeRate()).toBe(0.05);
  });

  it('should calculate accurate protection fees with 2 decimal precision', () => {
    // 5% of £100 is £5.00
    expect(calculateProtectionFee(100)).toBe(5);

    // 5% of £500 is £25.00
    expect(calculateProtectionFee(500)).toBe(25);

    // 5% of £349.99 is £17.50
    expect(calculateProtectionFee(349.99)).toBe(17.5);

    // 5% of £0 is £0.00
    expect(calculateProtectionFee(0)).toBe(0);
  });

  it('should parse environment variable percentage correctly', () => {
    process.env.NEXT_PUBLIC_BUYER_PROTECTION_FEE_PERCENT = '8';
    expect(getBuyerProtectionFeePercent()).toBe(8);
    expect(getBuyerProtectionFeeRate()).toBe(0.08);
    expect(calculateProtectionFee(100)).toBe(8);
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

    process.env.NEXT_PUBLIC_BUYER_PROTECTION_FEE_PERCENT = '5';

    expect(getBuyerProtectionFeePercent()).toBe(5);
    expect(calculateProtectionFee(200)).toBe(10);

    vi.unstubAllGlobals();
  });
});

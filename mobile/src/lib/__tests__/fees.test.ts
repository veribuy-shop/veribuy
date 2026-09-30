import { calculateBuyerProtectionFee, getBuyerProtectionFeePercent } from '../fees';
import { formatPrice } from '../currency';

describe('Mobile fees and currency utilities', () => {
  it('should calculate 5% buyer protection fee by default', () => {
    expect(getBuyerProtectionFeePercent()).toBe(5);
    expect(calculateBuyerProtectionFee(100)).toBe(5.0);
    expect(calculateBuyerProtectionFee(250)).toBe(12.5);
    expect(calculateBuyerProtectionFee(0)).toBe(0);
  });

  it('should format currency correctly for GBP', () => {
    expect(formatPrice(100, 'GBP')).toContain('100.00');
    expect(formatPrice(12.5, 'GBP')).toContain('12.50');
    expect(formatPrice(null)).toBe('£0.00');
  });
});

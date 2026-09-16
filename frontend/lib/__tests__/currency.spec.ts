import { describe, it, expect } from 'vitest';
import { formatPrice, getCurrencySymbol, DEFAULT_CURRENCY } from '../currency';

describe('Currency formatting utilities', () => {
  it('should format GBP prices properly by default', () => {
    expect(formatPrice(100)).toBe('£100.00');
    expect(formatPrice(49.99)).toBe('£49.99');
    expect(formatPrice('250.50')).toBe('£250.50');
  });

  it('should handle non-numeric inputs gracefully', () => {
    expect(formatPrice('invalid')).toBe('£0.00');
  });

  it('should support EUR and USD formatting', () => {
    expect(formatPrice(100, 'EUR')).toBe('€100.00');
    expect(formatPrice(100, 'USD')).toBe('US$100.00');
  });

  it('should return correct symbols for known currencies', () => {
    expect(getCurrencySymbol('GBP')).toBe('£');
    expect(getCurrencySymbol('EUR')).toBe('€');
    expect(getCurrencySymbol('USD')).toBe('$');
    expect(getCurrencySymbol('CAD')).toBe('CAD');
  });
});

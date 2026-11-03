import {
  buyerFacingPrice,
  calculateBuyerProtectionFee,
  getBuyerProtectionFeePercent,
} from '../fees';
import { setMarketplaceConfig } from '../marketplace-config';

const setFee = (buyerProtectionFeePercent: number) =>
  setMarketplaceConfig({
    buyerProtectionFeePercent,
    checkoutHoldMinutes: 45,
    auctionPaymentWindowHours: 48,
    offerPaymentWindowHours: 48,
    charityDonationGbp: 1,
  });
import { formatPrice } from '../currency';

describe('Mobile fees and currency utilities', () => {
  it('should show no fee until the server has reported its rate', () => {
    expect(getBuyerProtectionFeePercent()).toBe(0);
    expect(calculateBuyerProtectionFee(100)).toBe(0);
  });

  it('should calculate the fee from the rate the server reports', () => {
    setFee(5);
    expect(calculateBuyerProtectionFee(100)).toBe(5.0);
    expect(calculateBuyerProtectionFee(250)).toBe(12.5);
    expect(calculateBuyerProtectionFee(0)).toBe(0);

    setFee(8);
    expect(calculateBuyerProtectionFee(100)).toBe(8);
  });

  it('should format currency correctly for GBP', () => {
    expect(formatPrice(100, 'GBP')).toContain('100.00');
    expect(formatPrice(12.5, 'GBP')).toContain('12.50');
    expect(formatPrice(null)).toBe('£0.00');
  });
});

describe('buyerFacingPrice', () => {
  it('adds the Buyer Protection fee to the asking price', () => {
    setFee(5);
    expect(buyerFacingPrice(100)).toBe(105);
    expect(buyerFacingPrice(899)).toBe(943.95);
  });
});

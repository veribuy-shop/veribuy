/**
 * Default buyer protection fee percentage (5% platform fee)
 */
export const DEFAULT_BUYER_PROTECTION_FEE_PERCENT = 5;

export function getBuyerProtectionFeePercent(): number {
  return DEFAULT_BUYER_PROTECTION_FEE_PERCENT;
}

export function calculateBuyerProtectionFee(itemPrice: number, percent = DEFAULT_BUYER_PROTECTION_FEE_PERCENT): number {
  const p = Math.max(0, itemPrice || 0);
  const fee = p * (percent / 100);
  return Math.round(fee * 100) / 100;
}

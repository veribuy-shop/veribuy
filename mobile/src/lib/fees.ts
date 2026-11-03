import { getMarketplaceConfig } from './marketplace-config';

/**
 * Buyer protection fee utilities, for display. The rate is set only by the
 * backend's BUYER_PROTECTION_FEE_PERCENT, and the backend prices every order.
 * No fee is shown until the server has reported its rate, rather than guessing one.
 */
export function getBuyerProtectionFeePercent(): number {
  return getMarketplaceConfig().buyerProtectionFeePercent;
}

export function calculateBuyerProtectionFee(
  itemPrice: number,
  percent = getBuyerProtectionFeePercent(),
): number {
  const p = Math.max(0, itemPrice || 0);
  const fee = p * (percent / 100);
  return Math.round(fee * 100) / 100;
}


/**
 * What a buyer pays for the item: asking price + Buyer Protection, matching
 * the web. Only Royal Mail shipping is added at checkout.
 */
export function buyerFacingPrice(
  itemPrice: number,
  percent = getBuyerProtectionFeePercent(),
): number {
  const p = Math.max(0, Number(itemPrice) || 0);
  return Math.round((p + calculateBuyerProtectionFee(p, percent)) * 100) / 100;
}

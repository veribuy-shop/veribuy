/**
 * Fee utilities for VeriBuy marketplace.
 * Supports environment-configurable Buyer Protection Fee rates.
 */

/**
 * Returns the configured Buyer Protection Fee percentage as an integer (e.g. 5 for 5%).
 * Falls back to 5% if not set or invalid.
 */
export function getBuyerProtectionFeePercent(): number {
  const raw =
    process.env.NEXT_PUBLIC_BUYER_PROTECTION_FEE_PERCENT ||
    process.env.NEXT_PUBLIC_BUYER_PROTECTION_FEE_RATE ||
    process.env.BUYER_PROTECTION_FEE_PERCENT;
  if (!raw) return 5;
  const parsed = parseFloat(raw);
  if (isNaN(parsed) || parsed < 0) return 5;
  // If provided as a decimal like 0.05, convert to percentage 5
  return parsed < 1 && parsed > 0 ? Math.round(parsed * 100) : Math.round(parsed);
}

/**
 * Returns the configured Buyer Protection Fee rate as a decimal (e.g. 0.05 for 5%).
 */
export function getBuyerProtectionFeeRate(): number {
  return getBuyerProtectionFeePercent() / 100;
}

/**
 * Calculates the protection fee for a given item price.
 */
export function calculateProtectionFee(itemPrice: number): number {
  const rate = getBuyerProtectionFeeRate();
  return Math.round(itemPrice * rate * 100) / 100;
}

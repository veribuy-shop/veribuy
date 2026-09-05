/**
 * Fee utilities for VeriBuy marketplace.
 * Supports dynamic runtime configuration and environment-variable fallback.
 */

const STORAGE_KEY_PERCENT = 'veribuy_buyer_protection_fee_percent';

/**
 * Returns the configured Buyer Protection Fee percentage as an integer (e.g. 5 for 5%, 3 for 3%).
 * Checks localStorage first (runtime admin override), then environment variables, then defaults to 5.
 */
export function getBuyerProtectionFeePercent(): number {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PERCENT);
      if (stored !== null) {
        const parsedStored = parseFloat(stored);
        if (!isNaN(parsedStored) && parsedStored >= 0) {
          return parsedStored;
        }
      }
    } catch {
      // Ignore localStorage access errors
    }
  }

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
 * Updates the runtime Buyer Protection Fee percentage.
 * Persists to localStorage and dispatches a window event so all open views update immediately.
 */
export function setBuyerProtectionFeePercent(percent: number): void {
  const normalized = Math.max(0, Math.min(100, percent));
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_PERCENT, normalized.toString());
      window.dispatchEvent(new Event('veribuy_fee_changed'));
    } catch (e) {
      console.error('Failed to persist fee rate to localStorage:', e);
    }
  }
}

/**
 * Returns the configured Buyer Protection Fee rate as a decimal (e.g. 0.05 for 5%, 0.03 for 3%).
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

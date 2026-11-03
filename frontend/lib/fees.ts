/**
 * Fee utilities for VeriBuy marketplace.
 *
 * SECURITY: The Buyer Protection Fee is a monetary rate and is therefore
 * server-owned. The backend's `BUYER_PROTECTION_FEE_PERCENT` environment
 * variable is the only place it is set, and the backend computes the
 * authoritative fee during order creation.
 *
 * These helpers exist purely for DISPLAY, using the rate the server last
 * reported (see marketplace-config.ts). The value
 * must never be sourced from client-writable storage (e.g. localStorage), which
 * any user could tamper with to misrepresent the fee.
 */

import { fetchMarketplaceConfig, getMarketplaceConfig } from '@/lib/marketplace-config';

/** Fetches the Buyer Protection Fee percentage from the server. Display-only. */
export async function fetchBuyerProtectionFeePercent(): Promise<number> {
  return (await fetchMarketplaceConfig()).buyerProtectionFeePercent;
}

/**
 * Returns the Buyer Protection Fee percentage (e.g. 5 for 5%). Display-only —
 * the server recomputes this during checkout. No fee is shown until the server
 * has reported its rate, rather than guessing one.
 */
export function getBuyerProtectionFeePercent(): number {
  return getMarketplaceConfig().buyerProtectionFeePercent;
}

/**
 * Returns the Buyer Protection Fee rate as a decimal (e.g. 0.05 for 5%).
 * Display-only.
 */
export function getBuyerProtectionFeeRate(): number {
  return getBuyerProtectionFeePercent() / 100;
}

/**
 * Calculates the protection fee for a given item price. Display-only —
 * the authoritative figure is returned by the server on the created order.
 */
export function calculateProtectionFee(itemPrice: number): number {
  const rate = getBuyerProtectionFeeRate();
  return Math.round(itemPrice * rate * 100) / 100;
}

/**
 * The price a buyer pays for the item itself: seller price + Buyer Protection
 * Fee. This is what listings display, so the only amount added at checkout is
 * Royal Mail shipping. Display-only — the server charges the same figures.
 */
export function buyerFacingPrice(itemPrice: number): number {
  return Math.round((itemPrice + calculateProtectionFee(itemPrice)) * 100) / 100;
}

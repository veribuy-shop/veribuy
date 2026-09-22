/**
 * Fee utilities for VeriBuy marketplace.
 *
 * SECURITY: The Buyer Protection Fee is a monetary rate and is therefore
 * server-owned. The backend computes the authoritative fee from the
 * `BUYER_PROTECTION_FEE_PERCENT` environment variable during order creation.
 *
 * These helpers exist purely for DISPLAY. They read the public build-time env
 * var so the UI can show the same figure the server will charge. They must
 * never be treated as authoritative, and the value must never be sourced from
 * client-writable storage (e.g. localStorage), which any user could tamper
 * with to misrepresent the fee.
 */

const DEFAULT_FEE_PERCENT = 5;

/**
 * In-memory cache of the server-fetched rate (display-only). The backend
 * remains the sole authority — it recomputes the fee during order creation.
 */
let serverFeePercentCache: number | null = null;
let serverFeeFetchPromise: Promise<number> | null = null;

/**
 * Fetches the authoritative Buyer Protection Fee percentage from the server
 * (via the BFF). Cached in memory for the session; falls back to the
 * build-time env value on any failure. Display-only.
 */
export async function fetchBuyerProtectionFeePercent(): Promise<number> {
  if (serverFeePercentCache !== null) return serverFeePercentCache;
  if (serverFeeFetchPromise) return serverFeeFetchPromise;

  serverFeeFetchPromise = (async () => {
    try {
      const res = await fetch('/api/config/fees', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const value = Number(data?.buyerProtectionFeePercent);
        if (isFinite(value) && value >= 0) {
          serverFeePercentCache = value;
          return value;
        }
      }
    } catch {
      // Fall through to the build-time default.
    }
    return getBuyerProtectionFeePercent();
  })();

  try {
    return await serverFeeFetchPromise;
  } finally {
    serverFeeFetchPromise = null;
  }
}

/**
 * Returns the Buyer Protection Fee percentage as an integer (e.g. 5 for 5%).
 * Display-only — the server recomputes this during checkout.
 */
export function getBuyerProtectionFeePercent(): number {
  const raw =
    process.env.NEXT_PUBLIC_BUYER_PROTECTION_FEE_PERCENT ||
    process.env.NEXT_PUBLIC_BUYER_PROTECTION_FEE_RATE ||
    process.env.BUYER_PROTECTION_FEE_PERCENT;
  if (!raw) return DEFAULT_FEE_PERCENT;
  const parsed = parseFloat(raw);
  if (isNaN(parsed) || parsed < 0) return DEFAULT_FEE_PERCENT;
  // If provided as a decimal like 0.05, convert to percentage 5
  return parsed < 1 && parsed > 0 ? Math.round(parsed * 100) : Math.round(parsed);
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

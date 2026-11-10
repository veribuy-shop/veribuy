/**
 * Marketplace rules, as reported by the backend, whose environment variables
 * are the only place they are set. Display-only: the server enforces them.
 * The root layout supplies them (see marketplace-config-provider.tsx). They must
 * never be sourced from client-writable storage (e.g. localStorage).
 */
export interface MarketplaceConfig {
  buyerProtectionFeePercent: number;
  checkoutHoldMinutes: number;
  auctionPaymentWindowHours: number;
  offerPaymentWindowHours: number;
  charityDonationGbp: number;
  /** VeriBuy's handling charge per parcel, added to the Royal Mail rate. */
  shippingHandlingFees: { smallParcelGbp: number; mediumParcelGbp: number };
}

/** Null until the server has answered. Nothing is guessed in the meantime. */
let current: MarketplaceConfig | null = null;
let fetchedFromServer = false;
let fetchPromise: Promise<MarketplaceConfig> | null = null;

export function parseMarketplaceConfig(data: unknown): MarketplaceConfig | null {
  const raw = (data ?? {}) as Record<keyof MarketplaceConfig, unknown>;
  const handling = (raw.shippingHandlingFees ?? {}) as Record<string, unknown>;
  const config: MarketplaceConfig = {
    buyerProtectionFeePercent: Number(raw.buyerProtectionFeePercent),
    checkoutHoldMinutes: Number(raw.checkoutHoldMinutes),
    auctionPaymentWindowHours: Number(raw.auctionPaymentWindowHours),
    offerPaymentWindowHours: Number(raw.offerPaymentWindowHours),
    charityDonationGbp: Number(raw.charityDonationGbp),
    shippingHandlingFees: {
      smallParcelGbp: Number(handling.smallParcelGbp),
      mediumParcelGbp: Number(handling.mediumParcelGbp),
    },
  };
  const { shippingHandlingFees, ...rules } = config;
  const numbers = [...Object.values(rules), ...Object.values(shippingHandlingFees)];
  return numbers.every((value) => isFinite(value) && value >= 0) ? config : null;
}

export function setMarketplaceConfig(config: MarketplaceConfig): void {
  current = config;
}

export function isMarketplaceConfigKnown(): boolean {
  return current !== null;
}

export function getMarketplaceConfig(): MarketplaceConfig {
  return (
    current ?? {
      buyerProtectionFeePercent: 0,
      checkoutHoldMinutes: 0,
      auctionPaymentWindowHours: 0,
      offerPaymentWindowHours: 0,
      charityDonationGbp: 0,
      shippingHandlingFees: { smallParcelGbp: 0, mediumParcelGbp: 0 },
    }
  );
}

/** Asks the server (via the BFF) once per session. On failure, keeps what's known. */
export async function fetchMarketplaceConfig(): Promise<MarketplaceConfig> {
  if (fetchedFromServer) return getMarketplaceConfig();
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const res = await fetch('/api/config/marketplace', { cache: 'no-store' });
      const config = res.ok ? parseMarketplaceConfig(await res.json()) : null;
      if (config) {
        setMarketplaceConfig(config);
        fetchedFromServer = true;
      }
    } catch {
      // Keep what's known.
    }
    return getMarketplaceConfig();
  })();

  try {
    return await fetchPromise;
  } finally {
    fetchPromise = null;
  }
}

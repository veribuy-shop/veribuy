/**
 * Marketplace rules, as reported by the backend, whose environment variables
 * are the only place they are set. Display-only: the server enforces them.
 * The app loads them at launch (configService.refresh).
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

export function setMarketplaceConfig(config: MarketplaceConfig): void {
  current = config;
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

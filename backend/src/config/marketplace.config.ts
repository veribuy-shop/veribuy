/**
 * Marketplace rules set by environment variables. These are the only place the
 * values live: boot validation refuses to start without them, and web and mobile
 * read the ones they display from GET /transactions/config/marketplace.
 */
export const MARKETPLACE_ENV_VARS = [
  'CHECKOUT_HOLD_MINUTES',
  'AUCTION_PAYMENT_WINDOW_HOURS',
  'OFFER_PAYMENT_WINDOW_HOURS',
  'POSTING_OVERDUE_DAYS',
  'CHARITY_DONATION_GBP',
  'CLEARPAY_MAX_GBP',
  'CANCELLED_ORDER_RETENTION_DAYS',
] as const;

type MarketplaceEnvVar = (typeof MARKETPLACE_ENV_VARS)[number];

function positiveNumber(name: MarketplaceEnvVar): number {
  const value = Number(process.env[name]);
  if (!process.env[name] || !isFinite(value) || value <= 0) {
    throw new Error(`${name} must be set to a number above 0`);
  }
  return value;
}

/** How long an unpaid checkout holds an item before it's released to other buyers. */
export const checkoutHoldMinutes = () => positiveNumber('CHECKOUT_HOLD_MINUTES');
/** How long the winning bidder has to pay once an auction ends. */
export const auctionPaymentWindowHours = () => positiveNumber('AUCTION_PAYMENT_WINDOW_HOURS');
/** How long a buyer has to pay once their offer is accepted. */
export const offerPaymentWindowHours = () => positiveNumber('OFFER_PAYMENT_WINDOW_HOURS');
/** How long after payment an unposted order is flagged to admins. */
export const postingOverdueDays = () => positiveNumber('POSTING_OVERDUE_DAYS');
/** The optional charity donation offered at checkout. */
export const charityDonationGbp = () => positiveNumber('CHARITY_DONATION_GBP');
/** Stripe rejects a PaymentIntent when a listed method can't take the amount, so Clearpay stops here. */
export const clearpayMaxGbp = () => positiveNumber('CLEARPAY_MAX_GBP');
/** How long a cancelled order that was never paid is kept before it's deleted. */
export const cancelledOrderRetentionDays = () => positiveNumber('CANCELLED_ORDER_RETENTION_DAYS');

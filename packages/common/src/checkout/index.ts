/** How long an unpaid checkout holds an item before it's released to other buyers. */
export const CHECKOUT_HOLD_MINUTES = 45;

/** Whole minutes left on a checkout hold, rounded up, and never below zero. */
export function checkoutMinutesLeft(createdAt: Date | string, now = Date.now()): number {
  const endsAt = new Date(createdAt).getTime() + CHECKOUT_HOLD_MINUTES * 60 * 1000;
  return Math.max(0, Math.ceil((endsAt - now) / (60 * 1000)));
}

/** Whole minutes left on a checkout hold of the given length, rounded up, and never below zero. */
export function checkoutMinutesLeft(createdAt: Date | string, holdMinutes: number, now = Date.now()): number {
  const endsAt = new Date(createdAt).getTime() + holdMinutes * 60 * 1000;
  return Math.max(0, Math.ceil((endsAt - now) / (60 * 1000)));
}

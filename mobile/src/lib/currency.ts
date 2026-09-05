/**
 * Format an amount in the specified currency (default GBP).
 */
export function formatPrice(amount: number | string | null | undefined, currency = 'GBP'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : Number(amount || 0);
  if (isNaN(num)) return '£0.00';

  const curr = (currency || 'GBP').toUpperCase();
  const locale = curr === 'GBP' ? 'en-GB' : curr === 'USD' ? 'en-US' : 'en-GB';

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `£${num.toFixed(2)}`;
  }
}

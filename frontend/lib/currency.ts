/**
 * Currency formatting utility for UK market
 * Default currency: GBP (£)
 */

export const DEFAULT_CURRENCY = 'GBP';
export const DEFAULT_LOCALE = 'en-GB';

/**
 * Formats a price value with the appropriate currency symbol
 * @param price - Price as number or string
 * @param currency - Currency code (default: GBP)
 * @param options - Additional Intl.NumberFormat options
 * @returns Formatted price string (e.g., "£99.99")
 */
export function formatPrice(
  price: number | string,
  currency: string = DEFAULT_CURRENCY,
  options?: Intl.NumberFormatOptions
): string {
  const numericPrice = typeof price === 'string' ? parseFloat(price) : price;
  
  if (isNaN(numericPrice)) {
    return `£0.00`;
  }

  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...options,
  }).format(numericPrice);
}

/**
 * Get currency symbol for a given currency code
 * @param currency - Currency code (default: GBP)
 * @returns Currency symbol (e.g., "£")
 */
export function getCurrencySymbol(currency: string = DEFAULT_CURRENCY): string {
  const symbols: Record<string, string> = {
    'GBP': '£',
    'USD': '$',
    'EUR': '€',
  };
  
  return symbols[currency] || currency;
}

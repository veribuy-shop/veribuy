/**
 * Frontend shipping helpers.
 *
 * This module is a thin presentation adapter over the single authoritative
 * Royal Mail rate engine in `@veribuy/common/shipping`. It deliberately holds
 * NO rate table, weight catalogue, or postcode data of its own — duplicating
 * that logic previously allowed the price shown at checkout to drift from the
 * price the server actually charges.
 *
 * These quotes are for DISPLAY ONLY. The backend independently recomputes the
 * shipping fee during order creation and ignores any client-supplied figure.
 */

import {
  calculateRoyalMailRate,
  getShippingZoneFromPostcode,
  resolveDeviceWeightProfile,
  type RoyalMailService,
  type ShippingZone,
} from '@veribuy/common/shipping';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ShippingService = RoyalMailService;
export type ParcelSize = 'SMALL' | 'MEDIUM';
export type { ShippingZone };

export interface ShippingQuote {
  service: ShippingService;
  label: string;
  estimate: string;
  zone: ShippingZone;
  parcelSize: ParcelSize;
  baseFee: number;
  surcharge: number;
  insuranceCover: number;
  totalFee: number;
  isRecommended: boolean;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Determine the parcel size for a given device type, derived from the shared
 * weight catalogue rather than a local lookup table.
 */
export function getParcelSize(deviceType: string): ParcelSize {
  const profile = resolveDeviceWeightProfile(deviceType, '', '', 1);
  return profile.parcelFormat === 'SMALL_PARCEL' ? 'SMALL' : 'MEDIUM';
}

/**
 * Determine the shipping zone from a UK postcode.
 */
export function getShippingZone(postcode: string): ShippingZone {
  return getShippingZoneFromPostcode(postcode);
}

/**
 * Calculate a display shipping quote for a device type, postcode, and service.
 */
export function calculateShippingFee(
  deviceType: string,
  postcode: string,
  service: ShippingService,
  options: { brand?: string; model?: string; quantity?: number; itemPrice?: number } = {},
): ShippingQuote {
  const rate = calculateRoyalMailRate({
    deviceType,
    brand: options.brand,
    model: options.model,
    quantity: options.quantity ?? 1,
    itemPrice: options.itemPrice,
    postcode,
    service,
  });

  return {
    service: rate.service,
    label: rate.label,
    estimate: rate.estimate,
    zone: rate.zone,
    parcelSize: rate.weightProfile.parcelFormat === 'SMALL_PARCEL' ? 'SMALL' : 'MEDIUM',
    baseFee: rate.baseFee,
    surcharge: rate.surcharge,
    insuranceCover: rate.insuranceCover,
    totalFee: rate.totalFee,
    isRecommended: rate.isRecommended,
  };
}

/**
 * Get the selectable shipping options for the checkout service selector.
 */
export function getShippingOptions(
  deviceType: string,
  postcode: string,
  options: { brand?: string; model?: string; quantity?: number; itemPrice?: number } = {},
): ShippingQuote[] {
  const services: ShippingService[] = ['TRACKED_48', 'TRACKED_24'];
  if ((options.itemPrice ?? 0) >= 350) {
    services.push('SPECIAL_DELIVERY_1PM');
  }
  return services.map((service) =>
    calculateShippingFee(deviceType, postcode, service, options),
  );
}

/**
 * Format a shipping service enum value to a human-readable label.
 */
export function formatShippingService(service: string | null | undefined): string {
  switch (service) {
    case 'TRACKED_24':
      return 'Royal Mail Tracked 24';
    case 'TRACKED_48':
      return 'Royal Mail Tracked 48';
    case 'SPECIAL_DELIVERY_1PM':
      return 'Royal Mail Special Delivery 1pm';
    default:
      return 'Standard Shipping';
  }
}

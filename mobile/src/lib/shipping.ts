import {
  calculateRoyalMailRate,
  type RoyalMailService,
  type ShippingZone,
} from '@veribuy/common/shipping';

// One rate engine for backend, web and mobile, so the price a buyer sees is the
// price the server charges.
export {
  getShippingZoneFromPostcode,
  resolveDeviceWeightProfile,
  type DeviceWeightProfile,
  type RoyalMailParcelFormat,
  type RoyalMailService,
  type ShippingZone,
} from '@veribuy/common/shipping';

export interface ShippingQuote {
  service: RoyalMailService;
  label: string;
  estimate: string;
  zone: ShippingZone;
  parcelSize: 'SMALL' | 'MEDIUM';
  weightGrams: number;
  baseFee: number;
  surcharge: number;
  insuranceCover: number;
  totalFee: number;
  isRecommended: boolean;
}

export function calculateShippingFee(
  deviceType: string,
  postcode: string,
  service: RoyalMailService = 'TRACKED_48',
  options: { brand?: string; model?: string; quantity?: number; itemPrice?: number } = {},
): ShippingQuote {
  const rate = calculateRoyalMailRate({ ...options, deviceType, postcode, service });
  return {
    service: rate.service,
    label: rate.label,
    estimate: rate.estimate,
    zone: rate.zone,
    parcelSize: rate.weightProfile.parcelFormat === 'SMALL_PARCEL' ? 'SMALL' : 'MEDIUM',
    weightGrams: rate.weightProfile.totalWeightGrams,
    baseFee: rate.baseFee,
    surcharge: rate.surcharge,
    insuranceCover: rate.insuranceCover,
    totalFee: rate.totalFee,
    isRecommended: rate.isRecommended,
  };
}

export function getShippingOptions(
  deviceType: string,
  postcode: string,
  options: { brand?: string; model?: string; quantity?: number; itemPrice?: number } = {},
): ShippingQuote[] {
  const services: RoyalMailService[] = ['TRACKED_48', 'TRACKED_24', 'SPECIAL_DELIVERY_1PM'];
  return services.map((svc) => calculateShippingFee(deviceType, postcode, svc, options));
}

export function formatShippingService(service?: string | null): string {
  switch (service) {
    case 'TRACKED_24':
      return 'Royal Mail Tracked 24';
    case 'TRACKED_48':
      return 'Royal Mail Tracked 48';
    case 'SPECIAL_DELIVERY_1PM':
      return 'Special Delivery Guaranteed 1pm';
    default:
      return 'Royal Mail Tracked';
  }
}

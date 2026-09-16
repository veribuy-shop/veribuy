import {
  resolveDeviceWeightProfile,
  DeviceWeightProfile,
  RoyalMailParcelFormat,
} from './weight-mapping';

export type RoyalMailService = 'TRACKED_24' | 'TRACKED_48' | 'SPECIAL_DELIVERY_1PM';
export type RoyalMailServiceTier = RoyalMailService;
export type ShippingZone = 'UK_MAINLAND' | 'UK_REMOTE';

export interface RoyalMailRateBreakdown {
  service: RoyalMailService;
  label: string;
  estimate: string;
  zone: ShippingZone;
  weightProfile: DeviceWeightProfile;
  baseFee: number;
  surcharge: number;
  insuranceCover: number;
  totalFee: number;
  isRecommended: boolean;
}

const REMOTE_PREFIXES = ['BT', 'HS', 'IM', 'JE', 'GY', 'KW', 'ZE'];
const REMOTE_SURCHARGE = 2.50;

function isRemoteDistrict(prefix: string, district: number): boolean {
  switch (prefix) {
    case 'IV':
      return true;
    case 'PA':
      return district >= 20 && district <= 80;
    case 'PH':
      return district >= 17 && district <= 50;
    case 'KA':
      return district >= 27 && district <= 28;
    default:
      return false;
  }
}

export function getShippingZoneFromPostcode(postcode: string = ''): ShippingZone {
  const normalised = postcode.replace(/\s+/g, '').toUpperCase();
  const match = normalised.match(/^([A-Z]{1,2})(\d{1,2})/);
  if (!match) return 'UK_MAINLAND';

  const area = match[1];
  const district = parseInt(match[2], 10);

  if (REMOTE_PREFIXES.includes(area)) return 'UK_REMOTE';
  if (isRemoteDistrict(area, district)) return 'UK_REMOTE';

  return 'UK_MAINLAND';
}

/**
 * Rates table based on Royal Mail Business & Consumer price tables (2026).
 */
export function getRoyalMailBaseFee(
  service: RoyalMailService,
  format: RoyalMailParcelFormat,
  weightGrams: number,
): { baseFee: number; estimate: string; label: string; insuranceCover: number } {
  if (service === 'SPECIAL_DELIVERY_1PM') {
    if (weightGrams <= 500) {
      return { baseFee: 7.95, estimate: 'Guaranteed by 1pm next day', label: 'Royal Mail Special Delivery 1pm', insuranceCover: 750 };
    }
    if (weightGrams <= 1000) {
      return { baseFee: 9.45, estimate: 'Guaranteed by 1pm next day', label: 'Royal Mail Special Delivery 1pm', insuranceCover: 750 };
    }
    return { baseFee: 12.15, estimate: 'Guaranteed by 1pm next day', label: 'Royal Mail Special Delivery 1pm', insuranceCover: 750 };
  }

  if (service === 'TRACKED_24') {
    if (format === 'SMALL_PARCEL' && weightGrams <= 2000) {
      return { baseFee: 4.45, estimate: 'Next working day (Tracked 24)', label: 'Royal Mail Tracked 24', insuranceCover: 150 };
    }
    if (weightGrams <= 2000) {
      return { baseFee: 6.25, estimate: 'Next working day (Tracked 24)', label: 'Royal Mail Tracked 24 (Medium Parcel)', insuranceCover: 150 };
    }
    // Medium parcel 2kg - 10kg
    return { baseFee: 8.45, estimate: 'Next working day (Tracked 24)', label: 'Royal Mail Tracked 24 (Heavy Parcel)', insuranceCover: 150 };
  }

  // Default: TRACKED_48
  if (format === 'SMALL_PARCEL' && weightGrams <= 2000) {
    return { baseFee: 3.55, estimate: '2-3 working days (Tracked 48)', label: 'Royal Mail Tracked 48', insuranceCover: 150 };
  }
  if (weightGrams <= 2000) {
    return { baseFee: 5.35, estimate: '2-3 working days (Tracked 48)', label: 'Royal Mail Tracked 48 (Medium Parcel)', insuranceCover: 150 };
  }
  return { baseFee: 7.35, estimate: '2-3 working days (Tracked 48)', label: 'Royal Mail Tracked 48 (Heavy Parcel)', insuranceCover: 150 };
}

/**
 * Calculates a complete Royal Mail rate breakdown incorporating device automated weight profiling,
 * postcode zone classification, and compensation recommendation.
 */
export function calculateRoyalMailRate(options: {
  deviceType: string;
  brand?: string;
  model?: string;
  quantity?: number;
  itemPrice?: number;
  postcode?: string;
  service?: RoyalMailService;
}): RoyalMailRateBreakdown {
  const {
    deviceType,
    brand = '',
    model = '',
    quantity = 1,
    itemPrice = 0,
    postcode = '',
    service = 'TRACKED_48',
  } = options;

  const weightProfile = resolveDeviceWeightProfile(deviceType, brand, model, quantity);
  const zone = getShippingZoneFromPostcode(postcode);
  const surcharge = zone === 'UK_REMOTE' ? REMOTE_SURCHARGE : 0;

  const { baseFee, estimate, label, insuranceCover } = getRoyalMailBaseFee(
    service,
    weightProfile.parcelFormat,
    weightProfile.totalWeightGrams,
  );

  const totalFee = Math.round((baseFee + surcharge) * 100) / 100;
  // Recommend Special Delivery if device is high-value (> £750)
  const isRecommended = itemPrice > 750 ? service === 'SPECIAL_DELIVERY_1PM' : service === 'TRACKED_48';

  return {
    service,
    label,
    estimate,
    zone,
    weightProfile,
    baseFee,
    surcharge,
    insuranceCover,
    totalFee,
    isRecommended,
  };
}

/**
 * Returns all available Royal Mail shipping options for checkout selection.
 */
export function getRoyalMailShippingOptions(options: {
  deviceType: string;
  brand?: string;
  model?: string;
  quantity?: number;
  itemPrice?: number;
  postcode?: string;
}): RoyalMailRateBreakdown[] {
  const services: RoyalMailService[] = ['TRACKED_48', 'TRACKED_24'];
  if ((options.itemPrice ?? 0) >= 350) {
    services.push('SPECIAL_DELIVERY_1PM');
  }

  return services.map((service) =>
    calculateRoyalMailRate({ ...options, service }),
  );
}

export type RoyalMailService = 'TRACKED_48' | 'TRACKED_24' | 'SPECIAL_DELIVERY_1PM';
export type RoyalMailParcelFormat = 'SMALL_PARCEL' | 'MEDIUM_PARCEL';
export type ShippingZone = 'UK_MAINLAND' | 'UK_REMOTE';

export interface DeviceWeightProfile {
  deviceType: string;
  brand: string;
  model: string;
  baseWeightGrams: number;
  packagingAllowanceGrams: number;
  unitWeightGrams: number;
  totalWeightGrams: number;
  parcelFormat: RoyalMailParcelFormat;
  weightTierLabel: string;
  quantity: number;
}

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

export function resolveDeviceWeightProfile(
  deviceType: string = '',
  brand: string = '',
  model: string = '',
  quantity: number = 1,
): DeviceWeightProfile {
  const normType = deviceType.toLowerCase();
  const normModel = model.toLowerCase();

  let baseWeight = 200;
  let packaging = 180;
  let format: RoyalMailParcelFormat = 'SMALL_PARCEL';
  let tierLabel = 'Standard Electronics';

  if (normType.includes('smartwatch') || normType.includes('watch')) {
    if (normModel.includes('ultra')) {
      baseWeight = 62;
      packaging = 180;
      tierLabel = 'Smartwatch (Rugged / Ultra)';
    } else {
      baseWeight = 45;
      packaging = 160;
      tierLabel = 'Standard Smartwatch';
    }
  } else if (normType.includes('airpods') || normType.includes('earbud') || normType.includes('audio')) {
    if (normModel.includes('max') || normModel.includes('bose') || normModel.includes('wh-1000')) {
      baseWeight = 385;
      packaging = 220;
      tierLabel = 'Over-Ear Premium Headphones';
    } else {
      baseWeight = 55;
      packaging = 140;
      tierLabel = 'In-Ear Wireless Earbuds';
    }
  } else if (normType.includes('phone') || normType.includes('smartphone')) {
    if (normModel.includes('pro max') || normModel.includes('ultra') || normModel.includes('fold') || normModel.includes('plus')) {
      baseWeight = 230;
      packaging = 190;
      tierLabel = 'Smartphone (Large / Pro Max / Fold)';
    } else if (normModel.includes('mini') || normModel.includes('se') || normModel.includes('flip')) {
      baseWeight = 155;
      packaging = 170;
      tierLabel = 'Smartphone (Compact / Mini)';
    } else {
      baseWeight = 185;
      packaging = 180;
      tierLabel = 'Standard Smartphone';
    }
  } else if (normType.includes('tablet')) {
    if (normModel.includes('12.9') || normModel.includes('13') || normModel.includes('ultra')) {
      baseWeight = 680;
      packaging = 320;
      format = 'MEDIUM_PARCEL';
      tierLabel = 'Large Tablet (12-14")';
    } else {
      baseWeight = 470;
      packaging = 260;
      tierLabel = 'Standard Tablet (10-11")';
    }
  } else if (normType.includes('laptop')) {
    format = 'MEDIUM_PARCEL';
    if (normModel.includes('16') || normModel.includes('17') || normModel.includes('gaming')) {
      baseWeight = 2200;
      packaging = 450;
      tierLabel = 'Laptop (16-17" / Gaming)';
    } else {
      baseWeight = 1400;
      packaging = 350;
      tierLabel = 'Ultrabook (13-14")';
    }
  } else if (normType.includes('console')) {
    format = 'MEDIUM_PARCEL';
    if (normModel.includes('switch') || normModel.includes('deck')) {
      baseWeight = 670;
      packaging = 300;
      format = 'SMALL_PARCEL';
      tierLabel = 'Handheld Console';
    } else {
      baseWeight = 3900;
      packaging = 600;
      tierLabel = 'Home Console (PS5 / Xbox)';
    }
  } else if (normType.includes('desktop')) {
    format = 'MEDIUM_PARCEL';
    baseWeight = 2500;
    packaging = 500;
    tierLabel = 'Compact Desktop';
  }

  const unitWeight = baseWeight + packaging;
  const totalWeight = unitWeight * Math.max(1, quantity);

  return {
    deviceType,
    brand,
    model,
    baseWeightGrams: baseWeight,
    packagingAllowanceGrams: packaging,
    unitWeightGrams: unitWeight,
    totalWeightGrams: totalWeight,
    parcelFormat: format,
    weightTierLabel: tierLabel,
    quantity,
  };
}

export function getRoyalMailBaseFee(
  service: RoyalMailService,
  format: RoyalMailParcelFormat,
  weightGrams: number,
): { baseFee: number; estimate: string; label: string; insuranceCover: number } {
  if (service === 'SPECIAL_DELIVERY_1PM') {
    if (weightGrams <= 500) {
      return { baseFee: 7.95, estimate: 'Next working day by 1pm guaranteed', label: 'Special Delivery Guaranteed 1pm', insuranceCover: 750 };
    }
    if (weightGrams <= 1000) {
      return { baseFee: 9.45, estimate: 'Next working day by 1pm guaranteed', label: 'Special Delivery Guaranteed 1pm', insuranceCover: 750 };
    }
    return { baseFee: 12.15, estimate: 'Next working day by 1pm guaranteed', label: 'Special Delivery Guaranteed 1pm', insuranceCover: 750 };
  }

  if (service === 'TRACKED_24') {
    if (format === 'SMALL_PARCEL' && weightGrams <= 2000) {
      return { baseFee: 4.45, estimate: 'Next working day', label: 'Royal Mail Tracked 24', insuranceCover: 150 };
    }
    return { baseFee: 6.25, estimate: 'Next working day', label: 'Royal Mail Tracked 24 (Medium)', insuranceCover: 150 };
  }

  // TRACKED_48
  if (format === 'SMALL_PARCEL' && weightGrams <= 2000) {
    return { baseFee: 3.55, estimate: '2-3 working days', label: 'Royal Mail Tracked 48', insuranceCover: 150 };
  }
  return { baseFee: 5.35, estimate: '2-3 working days', label: 'Royal Mail Tracked 48 (Medium)', insuranceCover: 150 };
}

export function calculateShippingFee(
  deviceType: string,
  postcode: string,
  service: RoyalMailService = 'TRACKED_48',
  options: { brand?: string; model?: string; quantity?: number; itemPrice?: number } = {},
): ShippingQuote {
  const weightProfile = resolveDeviceWeightProfile(
    deviceType,
    options.brand,
    options.model,
    options.quantity ?? 1,
  );
  const zone = getShippingZoneFromPostcode(postcode);
  const surcharge = zone === 'UK_REMOTE' ? REMOTE_SURCHARGE : 0;

  const { baseFee, estimate, label, insuranceCover } = getRoyalMailBaseFee(
    service,
    weightProfile.parcelFormat,
    weightProfile.totalWeightGrams,
  );

  const totalFee = Math.round((baseFee + surcharge) * 100) / 100;
  const isRecommended = (options.itemPrice ?? 0) > 750
    ? service === 'SPECIAL_DELIVERY_1PM'
    : service === 'TRACKED_48';

  return {
    service,
    label,
    estimate,
    zone,
    parcelSize: weightProfile.parcelFormat === 'SMALL_PARCEL' ? 'SMALL' : 'MEDIUM',
    weightGrams: weightProfile.totalWeightGrams,
    baseFee,
    surcharge,
    insuranceCover,
    totalFee,
    isRecommended,
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

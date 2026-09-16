export type RoyalMailParcelFormat = 'SMALL_PARCEL' | 'MEDIUM_PARCEL';

export interface ParcelDimensions {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface DeviceWeightProfile {
  deviceType: string;
  brand: string;
  model: string;
  baseWeightGrams: number;
  packagingAllowanceGrams: number;
  unitWeightGrams: number;
  totalWeightGrams: number;
  parcelFormat: RoyalMailParcelFormat;
  dimensionsCm: ParcelDimensions;
  weightTierLabel: string;
  quantity: number;
}

interface WeightRule {
  deviceTypePattern?: RegExp;
  brandPattern?: RegExp;
  modelPattern?: RegExp;
  baseWeightGrams: number;
  packagingAllowanceGrams: number;
  parcelFormat: RoyalMailParcelFormat;
  dimensionsCm: ParcelDimensions;
  tierLabel: string;
}

const WEIGHT_RULES: WeightRule[] = [
  // ── Smartwatches ──
  {
    deviceTypePattern: /smartwatch|watch/i,
    modelPattern: /ultra/i,
    baseWeightGrams: 62,
    packagingAllowanceGrams: 180,
    parcelFormat: 'SMALL_PARCEL',
    dimensionsCm: { lengthCm: 16, widthCm: 12, heightCm: 6 },
    tierLabel: 'Smartwatch (Rugged / Ultra)',
  },
  {
    deviceTypePattern: /smartwatch|watch/i,
    baseWeightGrams: 45,
    packagingAllowanceGrams: 160,
    parcelFormat: 'SMALL_PARCEL',
    dimensionsCm: { lengthCm: 15, widthCm: 10, heightCm: 5 },
    tierLabel: 'Standard Smartwatch',
  },

  // ── Earbuds & Headphones (AirPods) ──
  {
    deviceTypePattern: /airpods|headphone|earbud|audio/i,
    modelPattern: /max|wh-1000|quietcomfort|bose/i,
    baseWeightGrams: 385,
    packagingAllowanceGrams: 220,
    parcelFormat: 'SMALL_PARCEL',
    dimensionsCm: { lengthCm: 24, widthCm: 20, heightCm: 10 },
    tierLabel: 'Over-Ear Premium Headphones',
  },
  {
    deviceTypePattern: /airpods|headphone|earbud|audio/i,
    baseWeightGrams: 55,
    packagingAllowanceGrams: 140,
    parcelFormat: 'SMALL_PARCEL',
    dimensionsCm: { lengthCm: 12, widthCm: 8, heightCm: 5 },
    tierLabel: 'In-Ear Wireless Earbuds',
  },

  // ── Smartphones ──
  {
    deviceTypePattern: /smartphone|phone/i,
    modelPattern: /pro\s*max|ultra|fold|plus|xl/i,
    baseWeightGrams: 230,
    packagingAllowanceGrams: 190,
    parcelFormat: 'SMALL_PARCEL',
    dimensionsCm: { lengthCm: 20, widthCm: 12, heightCm: 6 },
    tierLabel: 'Smartphone (Large / Pro Max / Fold)',
  },
  {
    deviceTypePattern: /smartphone|phone/i,
    modelPattern: /mini|se|compact|flip/i,
    baseWeightGrams: 155,
    packagingAllowanceGrams: 170,
    parcelFormat: 'SMALL_PARCEL',
    dimensionsCm: { lengthCm: 18, widthCm: 10, heightCm: 5 },
    tierLabel: 'Smartphone (Compact / Mini)',
  },
  {
    deviceTypePattern: /smartphone|phone/i,
    baseWeightGrams: 185,
    packagingAllowanceGrams: 180,
    parcelFormat: 'SMALL_PARCEL',
    dimensionsCm: { lengthCm: 19, widthCm: 11, heightCm: 6 },
    tierLabel: 'Standard Smartphone',
  },

  // ── Tablets ──
  {
    deviceTypePattern: /tablet|ipad/i,
    modelPattern: /pro\s*(12\.9|13)|ultra|surface\s*pro/i,
    baseWeightGrams: 680,
    packagingAllowanceGrams: 450,
    parcelFormat: 'MEDIUM_PARCEL',
    dimensionsCm: { lengthCm: 35, widthCm: 25, heightCm: 6 },
    tierLabel: 'Tablet (Large / Pro 12.9"+)',
  },
  {
    deviceTypePattern: /tablet|ipad/i,
    modelPattern: /mini/i,
    baseWeightGrams: 295,
    packagingAllowanceGrams: 260,
    parcelFormat: 'SMALL_PARCEL',
    dimensionsCm: { lengthCm: 24, widthCm: 18, heightCm: 5 },
    tierLabel: 'Tablet (Compact / Mini)',
  },
  {
    deviceTypePattern: /tablet|ipad/i,
    baseWeightGrams: 480,
    packagingAllowanceGrams: 350,
    parcelFormat: 'MEDIUM_PARCEL',
    dimensionsCm: { lengthCm: 30, widthCm: 22, heightCm: 5 },
    tierLabel: 'Standard Tablet (10-11")',
  },

  // ── Laptops ──
  {
    deviceTypePattern: /laptop/i,
    modelPattern: /16|17|legion|alienware|rog|predator|gaming/i,
    baseWeightGrams: 2350,
    packagingAllowanceGrams: 850,
    parcelFormat: 'MEDIUM_PARCEL',
    dimensionsCm: { lengthCm: 45, widthCm: 32, heightCm: 9 },
    tierLabel: 'Laptop (16"+ / High-Performance Gaming)',
  },
  {
    deviceTypePattern: /laptop/i,
    modelPattern: /air|xps\s*13|thinkpad\s*x1|zenbook|gram|13|14/i,
    baseWeightGrams: 1250,
    packagingAllowanceGrams: 600,
    parcelFormat: 'MEDIUM_PARCEL',
    dimensionsCm: { lengthCm: 36, widthCm: 26, heightCm: 7 },
    tierLabel: 'Ultrabook (13-14" Lightweight)',
  },
  {
    deviceTypePattern: /laptop/i,
    baseWeightGrams: 1650,
    packagingAllowanceGrams: 700,
    parcelFormat: 'MEDIUM_PARCEL',
    dimensionsCm: { lengthCm: 40, widthCm: 28, heightCm: 8 },
    tierLabel: 'Standard Laptop (14-15")',
  },

  // ── Gaming Consoles ──
  {
    deviceTypePattern: /gaming_console|console/i,
    modelPattern: /switch|steam\s*deck|rog\s*ally|handheld/i,
    baseWeightGrams: 420,
    packagingAllowanceGrams: 380,
    parcelFormat: 'SMALL_PARCEL',
    dimensionsCm: { lengthCm: 28, widthCm: 16, heightCm: 8 },
    tierLabel: 'Handheld Gaming Console',
  },
  {
    deviceTypePattern: /gaming_console|console/i,
    baseWeightGrams: 3900,
    packagingAllowanceGrams: 1300,
    parcelFormat: 'MEDIUM_PARCEL',
    dimensionsCm: { lengthCm: 48, widthCm: 38, heightCm: 18 },
    tierLabel: 'Home Gaming Console (PS5 / Xbox Series X)',
  },

  // ── Desktops ──
  {
    deviceTypePattern: /desktop/i,
    modelPattern: /mini|studio|nuc|tiny/i,
    baseWeightGrams: 1300,
    packagingAllowanceGrams: 700,
    parcelFormat: 'MEDIUM_PARCEL',
    dimensionsCm: { lengthCm: 28, widthCm: 28, heightCm: 12 },
    tierLabel: 'Compact Desktop / Mac Mini',
  },
  {
    deviceTypePattern: /desktop/i,
    baseWeightGrams: 5500,
    packagingAllowanceGrams: 1800,
    parcelFormat: 'MEDIUM_PARCEL',
    dimensionsCm: { lengthCm: 55, widthCm: 45, heightCm: 25 },
    tierLabel: 'Tower PC / Desktop Workstation',
  },
];

// Fallback defaults for unrecognized devices
const DEFAULT_WEIGHT_PROFILE: WeightRule = {
  baseWeightGrams: 300,
  packagingAllowanceGrams: 200,
  parcelFormat: 'SMALL_PARCEL',
  dimensionsCm: { lengthCm: 22, widthCm: 15, heightCm: 7 },
  tierLabel: 'Standard Electronics Parcel',
};

/**
 * Automatically calculates the packaged weight profile, dimensions, and Royal Mail parcel format
 * by analyzing device category, brand, and model.
 */
export function resolveDeviceWeightProfile(
  deviceType: string,
  brand: string = '',
  model: string = '',
  quantity: number = 1,
): DeviceWeightProfile {
  const cleanType = (deviceType || '').trim();
  const cleanBrand = (brand || '').trim();
  const cleanModel = (model || '').trim();
  const qty = Math.max(1, Math.floor(quantity) || 1);

  const matchedRule = WEIGHT_RULES.find((rule) => {
    if (rule.deviceTypePattern && !rule.deviceTypePattern.test(cleanType)) {
      return false;
    }
    if (rule.brandPattern && !rule.brandPattern.test(cleanBrand)) {
      return false;
    }
    if (rule.modelPattern && !rule.modelPattern.test(cleanModel)) {
      return false;
    }
    return true;
  }) || DEFAULT_WEIGHT_PROFILE;

  const unitWeight = matchedRule.baseWeightGrams + matchedRule.packagingAllowanceGrams;
  const totalWeight = unitWeight * qty;

  // Royal Mail Small Parcel limit is 2000g (2kg) and max 45x35x16cm.
  // If bulk units or item weight exceeds 2kg, it is automatically escalated to MEDIUM_PARCEL.
  let parcelFormat: RoyalMailParcelFormat = matchedRule.parcelFormat;
  if (totalWeight > 2000 || qty > 2) {
    parcelFormat = 'MEDIUM_PARCEL';
  }

  // Adjust dimensions for bulk quantity scaling
  const dimensionsCm: ParcelDimensions = {
    lengthCm: Math.min(61, Math.round(matchedRule.dimensionsCm.lengthCm * (qty > 1 ? 1.2 : 1))),
    widthCm: Math.min(46, Math.round(matchedRule.dimensionsCm.widthCm * (qty > 1 ? 1.2 : 1))),
    heightCm: Math.min(46, Math.round(matchedRule.dimensionsCm.heightCm * Math.min(4, qty))),
  };

  return {
    deviceType: cleanType || 'OTHER',
    brand: cleanBrand,
    model: cleanModel,
    baseWeightGrams: matchedRule.baseWeightGrams,
    packagingAllowanceGrams: matchedRule.packagingAllowanceGrams,
    unitWeightGrams: unitWeight,
    totalWeightGrams: totalWeight,
    parcelFormat,
    dimensionsCm,
    weightTierLabel: `${matchedRule.tierLabel}${qty > 1 ? ` (Batch of ${qty})` : ''}`,
    quantity: qty,
  };
}

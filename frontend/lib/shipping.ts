/**
 * Royal Mail UK domestic shipping rate configuration.
 *
 * Rates are based on Royal Mail online prices (royalmail.com/sending/uk):
 *   - Tracked 24: next working day delivery aim
 *   - Tracked 48: 2-3 working day delivery aim
 *
 * Both services include: tracking, photo on delivery, SMS/email notifications,
 * compensation cover up to £75, flexible delivery options.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ShippingService = 'TRACKED_24' | 'TRACKED_48';
export type ParcelSize = 'SMALL' | 'MEDIUM';
export type ShippingZone = 'UK_MAINLAND' | 'UK_REMOTE';

export interface ShippingRate {
  /** Base rate in GBP */
  base: number;
  /** Human-readable label */
  label: string;
  /** Delivery estimate */
  estimate: string;
}

export interface ShippingQuote {
  service: ShippingService;
  label: string;
  estimate: string;
  zone: ShippingZone;
  parcelSize: ParcelSize;
  baseFee: number;
  surcharge: number;
  totalFee: number;
}

// ---------------------------------------------------------------------------
// Rate card
// ---------------------------------------------------------------------------

const RATES: Record<ShippingService, Record<ParcelSize, ShippingRate>> = {
  TRACKED_24: {
    SMALL: { base: 4.45, label: 'Royal Mail Tracked 24', estimate: 'Next working day' },
    MEDIUM: { base: 6.25, label: 'Royal Mail Tracked 24', estimate: 'Next working day' },
  },
  TRACKED_48: {
    SMALL: { base: 3.55, label: 'Royal Mail Tracked 48', estimate: '2-3 working days' },
    MEDIUM: { base: 5.35, label: 'Royal Mail Tracked 48', estimate: '2-3 working days' },
  },
};

/** Remote area surcharge (GBP) */
const REMOTE_SURCHARGE = 2.50;

// ---------------------------------------------------------------------------
// Device type -> parcel size mapping
// ---------------------------------------------------------------------------

/**
 * Small Parcel: max 2kg, max 45x35x16cm — fits smartphones, smartwatches
 * Medium Parcel: max 20kg, max 61x46x46cm — tablets, laptops, desktops, consoles
 */
const DEVICE_PARCEL_MAP: Record<string, ParcelSize> = {
  SMARTPHONE: 'SMALL',
  SMARTWATCH: 'SMALL',
  TABLET: 'MEDIUM',
  LAPTOP: 'MEDIUM',
  DESKTOP: 'MEDIUM',
  GAMING_CONSOLE: 'MEDIUM',
  OTHER: 'MEDIUM',
};

// ---------------------------------------------------------------------------
// Postcode -> zone mapping
// ---------------------------------------------------------------------------

/**
 * Remote area postcode prefixes / ranges.
 *
 * Scottish Highlands & Islands: HS, IV, KW, PA20-PA80, PH17-PH50, ZE, KA27-KA28
 * Northern Ireland: BT
 * Channel Islands: JE, GY
 * Isle of Man: IM
 */
const REMOTE_PREFIXES = ['BT', 'HS', 'IM', 'JE', 'GY', 'KW', 'ZE'];

/**
 * Some postcode areas are only partially remote (e.g. IV, PA, PH, KA).
 * We check numeric district ranges for these.
 */
function isRemoteDistrict(prefix: string, district: number): boolean {
  switch (prefix) {
    case 'IV':
      // All IV postcodes are remote (Inverness & Highlands)
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Determine the parcel size for a given device type.
 */
export function getParcelSize(deviceType: string): ParcelSize {
  return DEVICE_PARCEL_MAP[deviceType] ?? 'MEDIUM';
}

/**
 * Determine the shipping zone from a UK postcode.
 *
 * Normalises the postcode (uppercase, trimmed) and checks against the
 * remote area prefix list and partial-range districts.
 *
 * Returns 'UK_REMOTE' for Scottish Highlands, Northern Ireland, Channel
 * Islands, and Isle of Man. All other valid UK postcodes are 'UK_MAINLAND'.
 */
export function getShippingZone(postcode: string): ShippingZone {
  const normalised = postcode.replace(/\s+/g, '').toUpperCase();

  // Extract the outward code (area letters + district number)
  // UK postcodes: A9, A99, A9A, AA9, AA99, AA9A followed by 9AA
  const match = normalised.match(/^([A-Z]{1,2})(\d{1,2})/);
  if (!match) return 'UK_MAINLAND'; // fallback for unrecognised format

  const area = match[1];
  const district = parseInt(match[2], 10);

  // Full-prefix remote areas (every district is remote)
  if (REMOTE_PREFIXES.includes(area)) return 'UK_REMOTE';

  // Partial-prefix remote areas
  if (isRemoteDistrict(area, district)) return 'UK_REMOTE';

  return 'UK_MAINLAND';
}

/**
 * Calculate the shipping fee for a given device type, postcode, and service.
 *
 * Returns a ShippingQuote with the full breakdown including any remote surcharge.
 */
export function calculateShippingFee(
  deviceType: string,
  postcode: string,
  service: ShippingService,
): ShippingQuote {
  const parcelSize = getParcelSize(deviceType);
  const zone = getShippingZone(postcode);
  const rate = RATES[service][parcelSize];
  const surcharge = zone === 'UK_REMOTE' ? REMOTE_SURCHARGE : 0;
  const totalFee = Math.round((rate.base + surcharge) * 100) / 100;

  return {
    service,
    label: rate.label,
    estimate: rate.estimate,
    zone,
    parcelSize,
    baseFee: rate.base,
    surcharge,
    totalFee,
  };
}

/**
 * Get both shipping options for a given device type and postcode.
 * Useful for rendering the service selector in the checkout UI.
 */
export function getShippingOptions(
  deviceType: string,
  postcode: string,
): [ShippingQuote, ShippingQuote] {
  return [
    calculateShippingFee(deviceType, postcode, 'TRACKED_48'),
    calculateShippingFee(deviceType, postcode, 'TRACKED_24'),
  ];
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
    default:
      return 'Standard Shipping';
  }
}

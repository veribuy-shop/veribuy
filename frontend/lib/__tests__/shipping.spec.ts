import { describe, it, expect } from 'vitest';
import {
  getParcelSize,
  getShippingZone,
  calculateShippingFee,
  getShippingOptions,
  formatShippingService,
} from '../shipping';

/**
 * These assert that the frontend display helpers stay in lockstep with the
 * authoritative rate engine in `@veribuy/common/shipping`. The frontend must
 * never carry its own rate table — a divergence here means the price shown at
 * checkout would differ from what the server actually charges.
 */
describe('Royal Mail UK shipping calculations', () => {
  describe('getParcelSize', () => {
    it('should assign SMALL size to lightweight devices', () => {
      expect(getParcelSize('SMARTPHONE')).toBe('SMALL');
      expect(getParcelSize('SMARTWATCH')).toBe('SMALL');
    });

    it('should assign MEDIUM size to bulky devices', () => {
      expect(getParcelSize('TABLET')).toBe('MEDIUM');
      expect(getParcelSize('LAPTOP')).toBe('MEDIUM');
      expect(getParcelSize('DESKTOP')).toBe('MEDIUM');
      expect(getParcelSize('GAMING_CONSOLE')).toBe('MEDIUM');
    });
  });

  describe('getShippingZone', () => {
    it('should classify mainland UK postcodes as UK_MAINLAND', () => {
      expect(getShippingZone('SW1A 1AA')).toBe('UK_MAINLAND');
      expect(getShippingZone('M1 1AA')).toBe('UK_MAINLAND');
      expect(getShippingZone('B1 1BB')).toBe('UK_MAINLAND');
      expect(getShippingZone('EH1 1YZ')).toBe('UK_MAINLAND');
    });

    it('should classify remote regions (Northern Ireland, Highlands & Islands) as UK_REMOTE', () => {
      expect(getShippingZone('BT1 1AA')).toBe('UK_REMOTE'); // Northern Ireland
      expect(getShippingZone('IV1 1AA')).toBe('UK_REMOTE'); // Inverness
      expect(getShippingZone('HS1 2AA')).toBe('UK_REMOTE'); // Outer Hebrides
      expect(getShippingZone('IM1 1AA')).toBe('UK_REMOTE'); // Isle of Man
      expect(getShippingZone('JE1 1AA')).toBe('UK_REMOTE'); // Jersey
      expect(getShippingZone('GY1 1AA')).toBe('UK_REMOTE'); // Guernsey
      expect(getShippingZone('ZE1 0AA')).toBe('UK_REMOTE'); // Shetland
    });
  });

  describe('calculateShippingFee', () => {
    it('should calculate Tracked 48 for a small parcel without surcharge on mainland', () => {
      const quote = calculateShippingFee('SMARTPHONE', 'SW1A 1AA', 'TRACKED_48');
      expect(quote.parcelSize).toBe('SMALL');
      expect(quote.zone).toBe('UK_MAINLAND');
      expect(quote.baseFee).toBe(3.55);
      expect(quote.surcharge).toBe(0);
      expect(quote.totalFee).toBe(3.55);
    });

    it('should apply the heavy-parcel rate and remote surcharge for a laptop to NI', () => {
      // A laptop resolves to 2350g, which exceeds the 2kg medium-parcel tier
      // and is therefore priced as a heavy parcel by the shared rate engine.
      const quote = calculateShippingFee('LAPTOP', 'BT1 1AA', 'TRACKED_24');
      expect(quote.parcelSize).toBe('MEDIUM');
      expect(quote.zone).toBe('UK_REMOTE');
      expect(quote.baseFee).toBe(8.45);
      expect(quote.surcharge).toBe(2.5);
      expect(quote.totalFee).toBe(10.95);
    });

    it('should price a tablet in the standard medium-parcel tier', () => {
      const quote = calculateShippingFee('TABLET', 'SW1A 1AA', 'TRACKED_48');
      expect(quote.parcelSize).toBe('MEDIUM');
      expect(quote.baseFee).toBe(5.35);
      expect(quote.totalFee).toBe(5.35);
    });
  });

  describe('getShippingOptions', () => {
    it('should offer Tracked 48 and Tracked 24 for ordinary items', () => {
      const options = getShippingOptions('SMARTPHONE', 'SW1A 1AA');
      expect(options.map((o) => o.service)).toEqual(['TRACKED_48', 'TRACKED_24']);
    });

    it('should additionally offer Special Delivery for high-value items', () => {
      const options = getShippingOptions('SMARTPHONE', 'SW1A 1AA', { itemPrice: 900 });
      expect(options.map((o) => o.service)).toContain('SPECIAL_DELIVERY_1PM');
    });
  });

  describe('formatShippingService', () => {
    it('should format service codes correctly', () => {
      expect(formatShippingService('TRACKED_24')).toBe('Royal Mail Tracked 24');
      expect(formatShippingService('TRACKED_48')).toBe('Royal Mail Tracked 48');
      expect(formatShippingService('SPECIAL_DELIVERY_1PM')).toBe('Royal Mail Special Delivery 1pm');
      expect(formatShippingService(null)).toBe('Standard Shipping');
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  getParcelSize,
  getShippingZone,
  calculateShippingFee,
  getShippingOptions,
  formatShippingService,
} from '../shipping';

describe('Royal Mail UK shipping calculations', () => {
  describe('getParcelSize', () => {
    it('should assign SMALL size to smartphones and smartwatches', () => {
      expect(getParcelSize('SMARTPHONE')).toBe('SMALL');
      expect(getParcelSize('SMARTWATCH')).toBe('SMALL');
    });

    it('should assign MEDIUM size to tablets, laptops, and others', () => {
      expect(getParcelSize('TABLET')).toBe('MEDIUM');
      expect(getParcelSize('LAPTOP')).toBe('MEDIUM');
      expect(getParcelSize('DESKTOP')).toBe('MEDIUM');
      expect(getParcelSize('OTHER')).toBe('MEDIUM');
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
    it('should calculate Tracked 48 for small parcel without surcharge on mainland', () => {
      const quote = calculateShippingFee('SMARTPHONE', 'SW1A 1AA', 'TRACKED_48');
      expect(quote.parcelSize).toBe('SMALL');
      expect(quote.zone).toBe('UK_MAINLAND');
      expect(quote.baseFee).toBe(3.55);
      expect(quote.surcharge).toBe(0);
      expect(quote.totalFee).toBe(3.55);
    });

    it('should calculate Tracked 24 for medium parcel with remote surcharge', () => {
      const quote = calculateShippingFee('LAPTOP', 'BT1 1AA', 'TRACKED_24');
      expect(quote.parcelSize).toBe('MEDIUM');
      expect(quote.zone).toBe('UK_REMOTE');
      expect(quote.baseFee).toBe(6.25);
      expect(quote.surcharge).toBe(2.50);
      expect(quote.totalFee).toBe(8.75);
    });
  });

  describe('formatShippingService', () => {
    it('should format service codes correctly', () => {
      expect(formatShippingService('TRACKED_24')).toBe('Royal Mail Tracked 24');
      expect(formatShippingService('TRACKED_48')).toBe('Royal Mail Tracked 48');
      expect(formatShippingService(null)).toBe('Standard Shipping');
    });
  });
});

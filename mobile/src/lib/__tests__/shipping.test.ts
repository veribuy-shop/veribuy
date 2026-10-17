import {
  calculateShippingFee,
  formatShippingService,
  getShippingOptions,
  getShippingZoneFromPostcode,
  resolveDeviceWeightProfile,
} from '../shipping';

describe('Mobile shipping & Royal Mail rate engine', () => {
  it('should resolve device weight profile accurately', () => {
    const phone = resolveDeviceWeightProfile('SMARTPHONE', 'Apple', 'iPhone 15 Pro Max', 1);
    expect(phone.parcelFormat).toBe('SMALL_PARCEL');
    expect(phone.totalWeightGrams).toBeGreaterThan(300);

    const laptop = resolveDeviceWeightProfile('LAPTOP', 'Apple', 'MacBook Pro 16', 1);
    expect(laptop.parcelFormat).toBe('MEDIUM_PARCEL');
    expect(laptop.totalWeightGrams).toBeGreaterThan(2000);

    const watch = resolveDeviceWeightProfile('SMARTWATCH', 'Apple', 'Watch Ultra', 1);
    expect(watch.parcelFormat).toBe('SMALL_PARCEL');
    expect(watch.totalWeightGrams).toBeLessThan(300);
  });

  it('should detect UK mainland vs remote postcodes correctly', () => {
    expect(getShippingZoneFromPostcode('SW1A 1AA')).toBe('UK_MAINLAND');
    expect(getShippingZoneFromPostcode('M1 1AE')).toBe('UK_MAINLAND');
    expect(getShippingZoneFromPostcode('BT1 5GS')).toBe('UK_REMOTE'); // Northern Ireland
    expect(getShippingZoneFromPostcode('ZE1 0AA')).toBe('UK_REMOTE'); // Shetland
    expect(getShippingZoneFromPostcode('IM1 1AA')).toBe('UK_REMOTE'); // Isle of Man
  });

  it('should calculate Royal Mail rates with remote surcharges', () => {
    const mainland = calculateShippingFee('SMARTPHONE', 'SW1A 1AA', 'TRACKED_48');
    expect(mainland.baseFee).toBe(3.55);
    expect(mainland.surcharge).toBe(0);
    expect(mainland.totalFee).toBe(3.55);

    const remote = calculateShippingFee('SMARTPHONE', 'BT1 1AA', 'TRACKED_48');
    expect(remote.baseFee).toBe(3.55);
    expect(remote.surcharge).toBe(2.50);
    expect(remote.totalFee).toBe(6.05);
  });

  it('should return all 3 Royal Mail service options', () => {
    const options = getShippingOptions('SMARTPHONE', 'SW1A 1AA');
    expect(options).toHaveLength(3);
    expect(options.map((o) => o.service)).toEqual([
      'TRACKED_48',
      'TRACKED_24',
      'SPECIAL_DELIVERY_1PM',
    ]);
  });

  it('should format service labels cleanly', () => {
    expect(formatShippingService('TRACKED_48')).toBe('Royal Mail Tracked 48');
    expect(formatShippingService('TRACKED_24')).toBe('Royal Mail Tracked 24');
    expect(formatShippingService('SPECIAL_DELIVERY_1PM')).toBe('Special Delivery Guaranteed 1pm');
  });
});

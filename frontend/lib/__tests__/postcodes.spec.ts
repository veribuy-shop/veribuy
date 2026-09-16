import { describe, it, expect } from 'vitest';

const ukPostcodeRegex = /^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/;

function normalizePostcode(raw: string): string {
  return raw.trim().replace(/\s+/g, '').toUpperCase();
}

function isValidUKPostcodePattern(postcode: string): boolean {
  const normalized = normalizePostcode(postcode);
  return ukPostcodeRegex.test(normalized);
}

describe('UK Postcode Normalization and Validation', () => {
  it('should validate valid UK postcode formats', () => {
    // London
    expect(isValidUKPostcodePattern('SW1A 1AA')).toBe(true);
    expect(isValidUKPostcodePattern('sw1a1aa')).toBe(true);
    expect(isValidUKPostcodePattern('EC1A 1BB')).toBe(true);
    expect(isValidUKPostcodePattern('W1A 0AX')).toBe(true);

    // Manchester & Birmingham
    expect(isValidUKPostcodePattern('M1 1AA')).toBe(true);
    expect(isValidUKPostcodePattern('B1 1BB')).toBe(true);

    // Scotland, Wales, Northern Ireland
    expect(isValidUKPostcodePattern('EH1 1YZ')).toBe(true);
    expect(isValidUKPostcodePattern('CF10 1AA')).toBe(true);
    expect(isValidUKPostcodePattern('BT1 1AA')).toBe(true);
  });

  it('should reject invalid UK postcode formats', () => {
    expect(isValidUKPostcodePattern('12345')).toBe(false);
    expect(isValidUKPostcodePattern('INVALID')).toBe(false);
    expect(isValidUKPostcodePattern('SW1A')).toBe(false);
    expect(isValidUKPostcodePattern('')).toBe(false);
  });

  it('should normalize postcodes by removing all spaces and converting to uppercase', () => {
    expect(normalizePostcode('  sw1a  1aa ')).toBe('SW1A1AA');
    expect(normalizePostcode('m1  1aa')).toBe('M11AA');
  });
});

import { describe, it, expect } from 'vitest';
import {
  sanitizeAuthUser,
  sanitizePublicProfile,
  sanitizePublicListing,
  sanitizeOrderWithPayment,
} from '../sanitize';

describe('DTO Sanitization & Privacy Guards', () => {
  it('should sanitize public listing by stripping IMEI and serialNumber while retaining public metadata', () => {
    const rawListing = {
      id: 'lst-123',
      sellerId: 'seller-456',
      title: 'iPhone 15 Pro Max',
      description: 'Used like new',
      deviceType: 'SMARTPHONE',
      brand: 'Apple',
      model: 'iPhone 15 Pro Max',
      storageCapacity: '512GB',
      color: 'Natural Titanium',
      price: '899.99',
      currency: 'GBP',
      status: 'ACTIVE',
      conditionGrade: 'A',
      trustLensStatus: 'PASSED',
      quantity: 5,
      isBulkListing: true,
      freeShipping: true,
      // Sensitive fields that MUST be stripped:
      imei: '356938035643803',
      serialNumber: 'F2LZ9X0M0D6T',
      rawApiResponse: { some: 'internal data' },
    };

    const sanitized = sanitizePublicListing(rawListing);

    expect(sanitized.id).toBe('lst-123');
    expect(sanitized.title).toBe('iPhone 15 Pro Max');
    expect(sanitized.price).toBe(899.99);
    expect(sanitized.isBulkListing).toBe(true);
    expect(sanitized.freeShipping).toBe(true);
    expect(sanitized.quantity).toBe(5);

    // Verify sensitive identifiers are not in the sanitized object
    expect((sanitized as any).imei).toBeUndefined();
    expect((sanitized as any).serialNumber).toBeUndefined();
    expect((sanitized as any).rawApiResponse).toBeUndefined();
  });

  it('should sanitize public profile with business credentials', () => {
    const rawProfile = {
      displayName: 'Direct Refurbishers Ltd',
      companyName: 'Direct Refurbishers Ltd',
      accountType: 'BUSINESS',
      avatarUrl: 'https://cdn.example.com/avatar.jpg',
      city: 'Manchester',
      country: 'United Kingdom',
      sellerRating: '4.9',
      // Sensitive internal fields
      kycVerifiedAt: '2026-01-01',
      ssn: '123-45-6789',
    };

    const sanitized = sanitizePublicProfile(rawProfile);

    expect(sanitized).not.toBeNull();
    expect(sanitized?.displayName).toBe('Direct Refurbishers Ltd');
    expect(sanitized?.accountType).toBe('BUSINESS');
    expect(sanitized?.companyName).toBe('Direct Refurbishers Ltd');
    expect(sanitized?.sellerRating).toBe(4.9);
    expect((sanitized as any).kycVerifiedAt).toBeUndefined();
  });

  it('should sanitize auth session user', () => {
    const rawUser = {
      id: 'usr-1',
      name: 'John Doe',
      email: 'john@example.com',
      role: 'BUYER',
      accountType: 'INDIVIDUAL',
      passwordHash: '$2a$12$abcdefg...',
    };

    const sanitized = sanitizeAuthUser(rawUser);

    expect(sanitized.id).toBe('usr-1');
    expect(sanitized.email).toBe('john@example.com');
    expect(sanitized.accountType).toBe('INDIVIDUAL');
    expect((sanitized as any).passwordHash).toBeUndefined();
  });
});

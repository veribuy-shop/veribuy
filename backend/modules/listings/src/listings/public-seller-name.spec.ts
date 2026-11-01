import { publicSellerName } from './listings.service';

describe('publicSellerName', () => {
  it('shows individuals as first name + last initial, never the full name', () => {
    expect(publicSellerName({ firstName: 'John', lastName: 'Seller' })).toBe('John S.');
  });

  it('derives the short form from a display name that defaults to the full name', () => {
    expect(publicSellerName({ displayName: 'Jane Tech Smith' })).toBe('Jane T.');
  });

  it('shows businesses by their company name', () => {
    expect(publicSellerName({ accountType: 'BUSINESS', companyName: 'E2E Refurb Ltd', firstName: 'Bea', lastName: 'Business' }))
      .toBe('E2E Refurb Ltd');
  });

  it('falls back safely when nothing is known', () => {
    expect(publicSellerName(null)).toBe('Verified Seller');
    expect(publicSellerName({ firstName: 'Cher' })).toBe('Cher');
  });
});

import { auditNote } from './audit.interceptor';
import { findDuplicateGroups } from './admin.service';

const listing = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  sellerId: 'seller-1',
  title: 'iPhone 13',
  imei: null,
  serialNumber: null,
  ...overrides,
});

describe('findDuplicateGroups', () => {
  it('matches the same IMEI, even across sellers and formatting', () => {
    const groups = findDuplicateGroups([
      listing('a', { imei: '356938035643809' }),
      listing('b', { imei: '35-693803-564380-9', sellerId: 'seller-2', title: 'Different title' }),
    ]);
    expect(groups).toEqual([['a', 'b']]);
  });

  it('matches serial numbers whatever their case', () => {
    expect(
      findDuplicateGroups([listing('a', { serialNumber: 'abc123' }), listing('b', { serialNumber: ' ABC123 ', title: 'Other' })]),
    ).toEqual([['a', 'b']]);
  });

  it('matches a repeated title from the same seller when there are no identifiers', () => {
    expect(findDuplicateGroups([listing('a'), listing('b', { title: ' iphone  13 ' })])).toEqual([['a', 'b']]);
  });

  it('does not match the same title from different sellers', () => {
    expect(findDuplicateGroups([listing('a'), listing('b', { sellerId: 'seller-2' })])).toEqual([]);
  });

  it('treats different identifiers as different devices despite the same title', () => {
    expect(
      findDuplicateGroups([listing('a', { imei: '356938035643809' }), listing('b', { imei: '490154203237518' })]),
    ).toEqual([]);
  });
});

describe('auditNote', () => {
  it('keeps the status and reason', () => {
    expect(auditNote({ status: 'DELISTED', reason: ' Duplicate listing ' })).toBe('status: DELISTED · Duplicate listing');
  });

  it('never records other fields such as passwords', () => {
    expect(auditNote({ password: 'secret', token: 'abc' })).toBeNull();
  });

  it('copes with no body', () => {
    expect(auditNote(undefined)).toBeNull();
  });
});

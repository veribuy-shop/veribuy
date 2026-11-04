import { auditNote } from './audit.interceptor';
import { AdminService, findDuplicateGroups } from './admin.service';

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

describe('getListings', () => {
  const run = async (query: { view?: string; search?: string }) => {
    const prisma: any = {
      listing: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    await new AdminService(prisma).getListings(query);
    return prisma.listing.findMany.mock.calls.at(-1)[0].where.AND;
  };

  it('leaves taken-down listings out of the All view', async () => {
    const [filter] = await run({});
    expect(filter).toEqual({ status: { notIn: ['DELISTED', 'REJECTED'] } });
  });

  it('still finds a taken-down listing when searching from All', async () => {
    const [filter] = await run({ search: '976e9b8a' });
    expect(filter).toEqual({});
  });
});

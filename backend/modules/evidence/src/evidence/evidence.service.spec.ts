import { BadRequestException } from '@nestjs/common';

import { EvidenceService } from './evidence.service';

// uuid ships as ES modules, which Jest doesn't transform here.
jest.mock('uuid', () => ({ v4: () => 'test-id' }));

describe('EvidenceService photo changes', () => {
  let prisma: any;
  let redis: any;
  let service: EvidenceService;

  const item = {
    id: 'item-1',
    url: 'https://example.test/a.jpg',
    metadata: {},
    pack: { id: 'pack-1', listingId: 'lst-1', listing: { sellerId: 'seller-1' } },
  };

  beforeEach(() => {
    prisma = {
      evidenceItem: {
        findUnique: jest.fn().mockResolvedValue(item),
        delete: jest.fn().mockResolvedValue(item),
      },
      listing: { findUnique: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    };
    redis = { del: jest.fn().mockResolvedValue(undefined) };
    const cloudinary = { extractPublicId: jest.fn().mockReturnValue(null), deleteFile: jest.fn() };
    service = new EvidenceService(prisma, cloudinary as any, {} as any, redis);
  });

  it('sends a verified live listing back to review when a photo is removed', async () => {
    prisma.listing.findUnique.mockResolvedValue({ status: 'ACTIVE', trustLensStatus: 'PASSED' });

    await service.deleteEvidenceItemWithOwnerCheck('item-1', 'seller-1', 'SELLER');

    expect(prisma.listing.update).toHaveBeenCalledWith({
      where: { id: 'lst-1' },
      data: { trustLensStatus: 'REQUIRES_REVIEW', status: 'UNDER_REVIEW' },
    });
    expect(redis.del).toHaveBeenCalledWith('listing:lst-1');
  });

  it('leaves a listing that was never verified alone', async () => {
    prisma.listing.findUnique.mockResolvedValue({ status: 'DRAFT', trustLensStatus: 'PENDING' });

    await service.deleteEvidenceItemWithOwnerCheck('item-1', 'seller-1', 'SELLER');

    expect(prisma.listing.update).not.toHaveBeenCalled();
  });

  it('keeps the photos of a sold device', async () => {
    prisma.listing.findUnique.mockResolvedValue({ status: 'SOLD', trustLensStatus: 'PASSED' });

    await expect(
      service.deleteEvidenceItemWithOwnerCheck('item-1', 'seller-1', 'SELLER'),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.evidenceItem.delete).not.toHaveBeenCalled();
  });

  it('lets an admin correct photos without triggering a review', async () => {
    prisma.listing.findUnique.mockResolvedValue({ status: 'SOLD', trustLensStatus: 'PASSED' });

    await service.deleteEvidenceItemWithOwnerCheck('item-1', 'admin-1', 'ADMIN');

    expect(prisma.evidenceItem.delete).toHaveBeenCalled();
    expect(prisma.listing.update).not.toHaveBeenCalled();
  });
});

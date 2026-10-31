import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { OffersService } from './offers.service';

describe('OffersService', () => {
  let prisma: any;
  let service: OffersService;
  const liveListing = {
    id: 'lst-1', sellerId: 'seller-1', price: 500, status: 'ACTIVE', format: 'FIXED_PRICE',
    trustLensStatus: 'PASSED', title: 'iPhone 15',
  };

  beforeEach(() => {
    prisma = {
      listing: { findUnique: jest.fn().mockResolvedValue(liveListing) },
      offer: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'off-1', ...data })),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      message: { create: jest.fn().mockResolvedValue({}) },
    };
    service = new OffersService(prisma);
  });

  it('records an offer and notifies the seller', async () => {
    await service.createOffer('lst-1', 'buyer-1', { amount: 450 });

    expect(prisma.offer.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount: 450, sellerId: 'seller-1', buyerId: 'buyer-1' }) }),
    );
    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ recipientId: 'seller-1' }) }),
    );
  });

  it('rejects offers on your own listing, at/above asking, or below 40%', async () => {
    await expect(service.createOffer('lst-1', 'seller-1', { amount: 450 })).rejects.toThrow(BadRequestException);
    await expect(service.createOffer('lst-1', 'buyer-1', { amount: 500 })).rejects.toThrow(BadRequestException);
    await expect(service.createOffer('lst-1', 'buyer-1', { amount: 100 })).rejects.toThrow(BadRequestException);
  });

  it('only the seller can accept, and acceptance opens a 48h pay window', async () => {
    prisma.offer.findUnique.mockResolvedValueOnce({
      id: 'off-1', listingId: 'lst-1', buyerId: 'buyer-1', sellerId: 'seller-1', amount: 450,
      status: 'PENDING', listing: { title: 'iPhone 15', status: 'ACTIVE' },
    });
    await expect(service.respond('off-1', 'buyer-1', { action: 'ACCEPT' })).rejects.toThrow(ForbiddenException);

    prisma.offer.findUnique.mockResolvedValueOnce({
      id: 'off-1', listingId: 'lst-1', buyerId: 'buyer-1', sellerId: 'seller-1', amount: 450,
      status: 'PENDING', listing: { title: 'iPhone 15', status: 'ACTIVE' },
    });
    await service.respond('off-1', 'seller-1', { action: 'ACCEPT' });

    expect(prisma.offer.updateMany).toHaveBeenCalledWith({
      where: { id: 'off-1', status: 'PENDING' },
      data: { status: 'ACCEPTED', expiresAt: expect.any(Date) },
    });
  });

  it('refuses to act on an offer that is no longer pending', async () => {
    prisma.offer.findUnique.mockResolvedValueOnce({
      id: 'off-1', listingId: 'lst-1', buyerId: 'buyer-1', sellerId: 'seller-1', amount: 450,
      status: 'DECLINED', listing: { title: 'iPhone 15', status: 'ACTIVE' },
    });
    await expect(service.respond('off-1', 'seller-1', { action: 'ACCEPT' })).rejects.toThrow(ConflictException);
  });
});

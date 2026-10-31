import { NotFoundException } from '@nestjs/common';
import { UlistingsController } from './listings.controller';

describe('UlistingsController.findOne visibility', () => {
  const listingsService = { findOne: jest.fn() };
  const controller = new UlistingsController(listingsService as any, {} as any);
  const draft = { id: 'lst-1', sellerId: 'seller-1', status: 'DRAFT' };

  beforeEach(() => listingsService.findOne.mockReset());

  it('hides unpublished listings from anonymous visitors', async () => {
    listingsService.findOne.mockResolvedValue(draft);
    await expect(controller.findOne('lst-1')).rejects.toThrow(NotFoundException);
  });

  it('hides unpublished listings from other users', async () => {
    listingsService.findOne.mockResolvedValue(draft);
    await expect(
      controller.findOne('lst-1', undefined, { userId: 'someone-else', role: 'BUYER' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('shows unpublished listings to their owner and admins', async () => {
    listingsService.findOne.mockResolvedValue(draft);
    await expect(controller.findOne('lst-1', undefined, { userId: 'seller-1', role: 'SELLER' })).resolves.toBe(draft);
    await expect(controller.findOne('lst-1', undefined, { userId: 'admin-1', role: 'ADMIN' })).resolves.toBe(draft);
  });

  it('shows live and sold listings to everyone', async () => {
    listingsService.findOne.mockResolvedValue({ ...draft, status: 'SOLD' });
    await expect(controller.findOne('lst-1')).resolves.toBeDefined();
  });
});

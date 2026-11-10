import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TrustLensService } from './trust-lens.service';
import { PrismaService } from '../../../../src/database/prisma.service';
import { ImeiCheckWorker } from '../imei-check/imei-check.worker';
import { ListingSyncService } from './listing-sync.service';
import { UserSyncService } from './user-sync.service';

describe('TrustLensService', () => {
  let service: TrustLensService;
  let prisma: any;
  let configService: any;
  let imeiWorker: any;
  let listingSync: any;
  let userSync: any;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn((cb) => cb(prisma)),
      listing: {
        findUnique: jest.fn(),
      },
      profile: {
        findUnique: jest.fn().mockResolvedValue({ accountType: 'INDIVIDUAL' }),
      },
      verificationRequest: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      identifierValidation: {
        create: jest.fn(),
      },
      evidencePack: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      evidenceChecklist: {
        create: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 5 }),
      },
    };

    configService = {
      get: jest.fn().mockReturnValue(null),
    };

    imeiWorker = {
      enqueue: jest.fn().mockResolvedValue(undefined),
      getCachedStatus: jest.fn().mockResolvedValue(null),
    };

    listingSync = {
      syncTrustLensStatus: jest.fn().mockResolvedValue(undefined),
      syncTrustLensResult: jest.fn().mockResolvedValue(undefined),
      notifySubmitted: jest.fn().mockResolvedValue(undefined),
    };

    userSync = {
      syncSellerRating: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrustLensService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: configService },
        { provide: ImeiCheckWorker, useValue: imeiWorker },
        { provide: ListingSyncService, useValue: listingSync },
        { provide: UserSyncService, useValue: userSync },
      ],
    }).compile();

    service = module.get<TrustLensService>(TrustLensService);
  });

  describe('createVerificationRequest', () => {
    it('should throw NotFoundException if listing does not exist', async () => {
      prisma.listing.findUnique.mockResolvedValue(null);

      await expect(
        service.createVerificationRequest({
          listingId: 'non-existent',
          sellerId: 'seller-1',
          imeiProvided: true,
          imei: '356938035643803',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if smartphone has no IMEI provided', async () => {
      prisma.listing.findUnique.mockResolvedValue({
        deviceType: 'SMARTPHONE',
      });

      await expect(
        service.createVerificationRequest({
          listingId: 'lst-1',
          sellerId: 'seller-1',
          imeiProvided: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create verification request and enqueue IMEI check for valid smartphone', async () => {
      prisma.listing.findUnique.mockResolvedValue({
        deviceType: 'SMARTPHONE',
      });

      const mockCreatedRequest = {
        id: 'vr-1',
        listingId: 'lst-1',
        sellerId: 'seller-1',
        status: 'PENDING',
      };

      prisma.verificationRequest.create.mockResolvedValue(mockCreatedRequest);
      prisma.verificationRequest.findUnique.mockResolvedValue(mockCreatedRequest);
      prisma.identifierValidation.create.mockResolvedValue({ id: 'iv-1', verificationRequestId: 'vr-1' });
      prisma.evidenceChecklist.create.mockResolvedValue({ id: 'ec-1' });

      const result = await service.createVerificationRequest({
        listingId: 'lst-1',
        sellerId: 'seller-1',
        imeiProvided: true,
        imei: '356938035643803',
        brand: 'Apple',
      });

      expect(prisma.verificationRequest.create).toHaveBeenCalled();
      expect(imeiWorker.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          verificationRequestId: 'vr-1',
          listingId: 'lst-1',
          imei: '356938035643803',
          brand: 'Apple',
        }),
      );
      expect(result).toEqual(mockCreatedRequest);
    });

    it('routes a serial-only non-phone device to manual review without an IMEI check', async () => {
      prisma.listing.findUnique.mockResolvedValue({ deviceType: 'AIRPODS' });
      const created = { id: 'vr-3', listingId: 'lst-3', status: 'REQUIRES_REVIEW' };
      prisma.verificationRequest.create.mockResolvedValue(created);
      prisma.verificationRequest.findUnique.mockResolvedValue(created);
      prisma.identifierValidation.create.mockResolvedValue({ id: 'iv-3' });

      await service.createVerificationRequest({
        listingId: 'lst-3',
        sellerId: 'seller-1',
        serialProvided: true,
        serialNumber: 'H6WXYZ123ABC',
        brand: 'Apple',
      } as any);

      // A serial-only job would fail in the IMEI worker and auto-reject the listing.
      expect(imeiWorker.enqueue).not.toHaveBeenCalled();
      expect(prisma.verificationRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'REQUIRES_REVIEW' }) }),
      );
      expect(listingSync.syncTrustLensResult).toHaveBeenCalledWith('lst-3', 'REQUIRES_REVIEW', undefined, []);
    });

    it('should pre-fulfill checklist items if evidence pack with images already exists', async () => {
      prisma.listing.findUnique.mockResolvedValue({
        deviceType: 'SMARTPHONE',
      });

      prisma.evidencePack.findUnique.mockResolvedValue({
        items: [
          { type: 'DEVICE_IMAGE' },
          { type: 'SETTINGS_SCREENSHOT' },
        ],
      });

      const mockCreatedRequest = {
        id: 'vr-2',
        listingId: 'lst-2',
        sellerId: 'seller-1',
        status: 'PENDING',
      };

      prisma.verificationRequest.create.mockResolvedValue(mockCreatedRequest);
      prisma.verificationRequest.findUnique.mockResolvedValue(mockCreatedRequest);
      prisma.identifierValidation.create.mockResolvedValue({ id: 'iv-2', verificationRequestId: 'vr-2' });

      await service.createVerificationRequest({
        listingId: 'lst-2',
        sellerId: 'seller-1',
        imeiProvided: true,
        imei: '356938035643803',
      });

      expect(prisma.evidenceChecklist.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            type: 'IMAGE',
            fulfilled: true,
            fulfilledAt: expect.any(Date),
          }),
          expect.objectContaining({
            type: 'SCREENSHOT',
            fulfilled: true,
            fulfilledAt: expect.any(Date),
          }),
        ]),
      });
    });
  });

  describe('rerunImeiCheck', () => {
    it('should throw NotFoundException if verification request does not exist', async () => {
      prisma.verificationRequest.findUnique.mockResolvedValue(null);

      await expect(service.rerunImeiCheck('lst-not-found')).rejects.toThrow(NotFoundException);
    });

    it('should reset status to IN_PROGRESS, notify listingSync, and re-enqueue IMEI check', async () => {
      const mockVr = {
        id: 'vr-10',
        listingId: 'lst-10',
        status: 'REQUIRES_REVIEW',
        identifierValidation: {
          imei: '356938035643803',
          serialNumber: 'SN12345',
        },
        listing: {
          imei: '356938035643803',
          serialNumber: 'SN12345',
          brand: 'Apple',
        },
      };

      const updatedVr = {
        ...mockVr,
        status: 'IN_PROGRESS',
        reviewNotes: 'Re-running automated IMEI telemetry check...',
        completedAt: null,
      };

      prisma.verificationRequest.findUnique.mockResolvedValue(mockVr);
      prisma.verificationRequest.update.mockResolvedValue(updatedVr);

      const result = await service.rerunImeiCheck('lst-10');

      expect(prisma.verificationRequest.update).toHaveBeenCalledWith({
        where: { id: 'vr-10' },
        data: {
          status: 'IN_PROGRESS',
          reviewNotes: 'Re-running automated IMEI telemetry check...',
          completedAt: null,
        },
      });

      expect(listingSync.syncTrustLensResult).toHaveBeenCalledWith(
        'lst-10',
        'IN_PROGRESS',
        undefined,
        [],
      );

      expect(imeiWorker.enqueue).toHaveBeenCalledWith({
        verificationRequestId: 'vr-10',
        listingId: 'lst-10',
        imei: '356938035643803',
        serialNumber: 'SN12345',
        brand: 'Apple',
      });

      expect(result).toEqual(updatedVr);
    });
  });

  describe('updateVerificationStatus', () => {
    it('waits for the listing to be updated before answering', async () => {
      prisma.verificationRequest.findUnique.mockResolvedValue({
        completedAt: null,
        conditionGrade: null,
        listing: { sellerId: 'seller-1' },
      });
      prisma.verificationRequest.update.mockResolvedValue({ conditionGrade: null });
      prisma.verificationRequest.count = jest.fn().mockResolvedValue(1);

      let finishSync: () => void = () => {};
      listingSync.syncTrustLensResult.mockReturnValue(
        new Promise<void>((resolve) => {
          finishSync = resolve;
        }),
      );

      let answered = false;
      const pending = service
        .updateVerificationStatus('lst-1', 'FAILED', 'Photos are blurry')
        .then(() => {
          answered = true;
        });

      await new Promise((resolve) => setImmediate(resolve));
      expect(listingSync.syncTrustLensResult).toHaveBeenCalledWith(
        'lst-1',
        'FAILED',
        undefined,
        [],
        'Photos are blurry',
      );
      expect(answered).toBe(false);

      finishSync();
      await pending;
      expect(answered).toBe(true);
    });
  });
});

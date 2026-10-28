import { Test, TestingModule } from '@nestjs/testing';
import { ImeiCheckWorker, ImeiCheckJob } from './imei-check.worker';
import { PrismaService } from '../../../../src/database/prisma.service';
import { ImeiCheckService } from './imei-check.service';
import { ListingSyncService } from '../trust-lens/listing-sync.service';
import { UserSyncService } from '../trust-lens/user-sync.service';
import { RedisService } from '@veribuy/redis-cache';

describe('ImeiCheckWorker', () => {
  let worker: ImeiCheckWorker;
  let prisma: any;
  let imeiCheckService: any;
  let listingSync: any;
  let userSync: any;
  let redis: any;

  beforeEach(async () => {
    prisma = {
      verificationRequest: {
        findUnique: jest.fn().mockResolvedValue({ status: 'PENDING', completedAt: null }),
        update: jest.fn().mockResolvedValue({
          id: 'vr-1',
          listing: { sellerId: 'seller-1' },
        }),
      },
      identifierValidation: {
        update: jest.fn().mockResolvedValue({}),
      },
      imeiRegistry: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      evidenceItem: {
        count: jest.fn().mockResolvedValue(0),
      },
      evidenceChecklist: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    imeiCheckService = {
      checkImei: jest.fn(),
    };

    listingSync = {
      syncTrustLensResult: jest.fn().mockResolvedValue(undefined),
    };

    userSync = {
      syncVerificationStatus: jest.fn().mockResolvedValue(undefined),
    };

    redis = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn().mockResolvedValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImeiCheckWorker,
        { provide: PrismaService, useValue: prisma },
        { provide: ImeiCheckService, useValue: imeiCheckService },
        { provide: ListingSyncService, useValue: listingSync },
        { provide: UserSyncService, useValue: userSync },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    worker = module.get<ImeiCheckWorker>(ImeiCheckWorker);
  });

  const baseJob: ImeiCheckJob = {
    verificationRequestId: 'vr-1',
    listingId: 'lst-1',
    imei: '356938035643803',
    brand: 'Apple',
  };

  describe('process routing logic', () => {
    it('should route to REQUIRES_REVIEW when IMEI is clean but evidence photos are 0', async () => {
      imeiCheckService.checkImei.mockResolvedValue({
        imeiValid: true,
        icloudLocked: false,
        reportedStolen: false,
        blacklisted: false,
        flags: ['CLEAN'],
        rawApiResponse: {},
        checksRun: ['gsma_blacklist'],
      });
      prisma.evidenceItem.count.mockResolvedValue(0);

      await worker.process(baseJob);

      expect(prisma.verificationRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'vr-1' },
          data: expect.objectContaining({
            status: 'REQUIRES_REVIEW',
            reviewNotes: expect.stringContaining('no device images were uploaded'),
          }),
        }),
      );
      expect(listingSync.syncTrustLensResult).not.toHaveBeenCalledWith('lst-1', 'PASSED', undefined, []);
    });

    it('should route to PASSED when IMEI is clean and evidence photos exist', async () => {
      imeiCheckService.checkImei.mockResolvedValue({
        imeiValid: true,
        icloudLocked: false,
        reportedStolen: false,
        blacklisted: false,
        flags: ['CLEAN'],
        rawApiResponse: {},
        checksRun: ['gsma_blacklist'],
      });
      prisma.evidenceItem.count.mockResolvedValue(3);

      await worker.process(baseJob);

      expect(prisma.verificationRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'vr-1' },
          data: expect.objectContaining({
            status: 'PASSED',
          }),
        }),
      );
      expect(listingSync.syncTrustLensResult).toHaveBeenCalledWith('lst-1', 'PASSED', undefined, []);
      expect(userSync.syncVerificationStatus).toHaveBeenCalledWith('seller-1', 'VERIFIED');
    });

    it('should route to REQUIRES_REVIEW when check could not run (NOT_RUN flag)', async () => {
      imeiCheckService.checkImei.mockResolvedValue({
        imeiValid: false,
        icloudLocked: false,
        reportedStolen: false,
        blacklisted: false,
        flags: ['NOT_RUN'],
        rawApiResponse: {},
        checksRun: [],
      });

      await worker.process(baseJob);

      expect(prisma.verificationRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'vr-1' },
          data: expect.objectContaining({
            status: 'REQUIRES_REVIEW',
            reviewNotes: expect.stringContaining('timed out or could not run'),
          }),
        }),
      );
    });

    it('should route to REQUIRES_REVIEW with integrity flags when telemetry detects issues', async () => {
      imeiCheckService.checkImei.mockResolvedValue({
        imeiValid: false,
        icloudLocked: false,
        reportedStolen: false,
        blacklisted: false,
        flags: ['IMEI_MISMATCH'],
        rawApiResponse: {},
        checksRun: ['gsma_blacklist'],
      });

      await worker.process(baseJob);

      expect(prisma.verificationRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'vr-1' },
          data: expect.objectContaining({
            status: 'REQUIRES_REVIEW',
            integrityFlags: { set: ['IMEI_MISMATCH'] },
            reviewNotes: expect.stringContaining('IMEI_MISMATCH'),
          }),
        }),
      );
    });
  });
});


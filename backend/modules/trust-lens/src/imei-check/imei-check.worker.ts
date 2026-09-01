import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../../src/database/prisma.service';
import { ImeiCheckService } from './imei-check.service';
import { ListingSyncService } from '../trust-lens/listing-sync.service';
import { UserSyncService } from '../trust-lens/user-sync.service';
import { RedisService } from '@veribuy/redis-cache';
import type { Redis } from 'ioredis';

export interface ImeiCheckJob {
  verificationRequestId: string;
  listingId: string;
  imei?: string;
  serialNumber?: string;
  brand?: string;
  attempts?: number;
}

const QUEUE_KEY = 'veribuy:imei-check:queue';
const STATUS_PREFIX = 'veribuy:verification-status';
const STATUS_TTL_SECONDS = 3600;
const MAX_ATTEMPTS = 2;

function maskImei(imei?: string): string {
  if (!imei || imei.length < 4) return '[not provided]';
  return `****${imei.slice(-4)}`;
}

@Injectable()
export class ImeiCheckWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImeiCheckWorker.name);
  private active = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private prisma: PrismaService,
    private imeiCheckService: ImeiCheckService,
    private listingSync: ListingSyncService,
    private userSync: UserSyncService,
    private redis: RedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.active = true;
    this.pollTimer = setInterval(() => {
      this.drain().catch((err) =>
        this.logger.error(`IMEI check drain error: ${(err as Error).message}`, (err as Error).stack),
      );
    }, 1000);
    // Log whether the IMEI check API key is configured so deployment issues
    // are visible immediately in Render logs.
    const hasKey = Boolean(this.imeiCheckService['apiKey']);
    this.logger.log(
      `IMEI check worker started (apiKey=${hasKey ? 'SET' : 'MISSING — set IMEI_CHECK_API_KEY on Render'})`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    this.active = false;
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.logger.log('IMEI check worker stopped');
  }

  private redisClient(): Redis | null {
    let client: Redis;
    try {
      client = this.redis.getClient();
    } catch {
      client = undefined as unknown as Redis;
    }
    if (!client || (client as any).status === 'end' || (client as any).status === 'close') {
      this.logger.error(
        'IMEI queue unavailable: Redis is not connected (check REDIS_DISABLED / REDIS_URL / REDIS_TLS). ' +
          'IMEI checks will NOT run while the queue is down.',
      );
      return null;
    }
    return client;
  }

  async enqueue(job: ImeiCheckJob): Promise<number> {
    const client = this.redisClient();
    if (!client) {
      throw new Error('Redis unavailable — cannot enqueue IMEI check job');
    }
    const serialized = JSON.stringify({ ...job, attempts: job.attempts ?? 0 });
    return await client.rpush(QUEUE_KEY, serialized);
  }

  private async drain(): Promise<void> {
    const client = this.redisClient();
    if (!client) return;
    while (this.active) {
      const item = await client.lpop(QUEUE_KEY);
      if (!item) return;
      let job: ImeiCheckJob;
      try {
        job = JSON.parse(item);
      } catch {
        this.logger.error(`Dropped malformed IMEI check job`);
        continue;
      }
      try {
        await this.process(job);
      } catch (err) {
        const attempts = (job.attempts ?? 0) + 1;
        this.logger.error(
          `Failed to process IMEI check job for listing ${job.listingId}: ${(err as Error).message}`,
          (err as Error).stack,
        );
        if (attempts < MAX_ATTEMPTS) {
          await client
            .rpush(QUEUE_KEY, JSON.stringify({ ...job, attempts }))
            .catch(() => {});
        } else {
          this.logger.error(
            `IMEI check job for listing ${job.listingId} exceeded MAX_ATTEMPTS — giving up.`,
          );
          // Write terminal FAILED status so the FE doesn't poll forever.
          await this.cacheStatus(
            job.verificationRequestId,
            job.listingId,
            'FAILED',
            { error: 'IMEI check failed after retries' },
          );
          await this.writeTerminalFailure(job);
        }
      }
    }
  }

  private async cacheStatus(
    verificationRequestId: string,
    listingId: string,
    status: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const value = { status, updatedAt: new Date().toISOString(), ...payload };
    await this.redis
      .set(`${STATUS_PREFIX}:${verificationRequestId}`, value, STATUS_TTL_SECONDS)
      .catch(() => {});
    await this.redis
      .set(`${STATUS_PREFIX}:listing:${listingId}`, value, STATUS_TTL_SECONDS)
      .catch(() => {});
  }

  async getCachedStatus(listingId: string): Promise<Record<string, unknown> | null> {
    return await this.redis.get<Record<string, unknown>>(`${STATUS_PREFIX}:listing:${listingId}`);
  }

  /**
   * Write a FAILED status back to the VerificationRequest + Listing when the
   * worker gives up. Without this, the DB record stays PENDING and the FE polls
   * forever because no terminal status ever appears in Redis.
   */
  private async writeTerminalFailure(job: ImeiCheckJob): Promise<void> {
    try {
      await this.prisma.verificationRequest.update({
        where: { id: job.verificationRequestId },
        data: {
          status: 'FAILED',
          reviewNotes: 'IMEI check failed after retries — please re-list and try again.',
          completedAt: new Date(),
        },
      });
      await this.listingSync
        .syncTrustLensResult(job.listingId, 'FAILED', undefined, [])
        .catch(() => {});
    } catch (err) {
      this.logger.error(
        `Failed to write terminal FAILED status for listing ${job.listingId}: ${(err as Error).message}`,
      );
    }
  }

  async process(job: ImeiCheckJob): Promise<void> {
    const { verificationRequestId, listingId, imei, serialNumber, brand } = job;

    if (!imei) {
      this.logger.warn(
        `IMEI check job without IMEI for listing ${listingId} — writing FAILED and skipping`,
      );
      await this.cacheStatus(verificationRequestId, listingId, 'FAILED', {
        error: 'No IMEI provided',
      });
      await this.writeTerminalFailure(job);
      return;
    }

    // Write IN_PROGRESS so the FE shows a live indicator immediately.
    await this.cacheStatus(verificationRequestId, listingId, 'IN_PROGRESS', {});

    const current = await this.prisma.verificationRequest.findUnique({
      where: { id: verificationRequestId },
      select: { status: true, completedAt: true },
    });
    if (current?.status === 'PASSED' || current?.status === 'FAILED') {
      this.logger.warn(
        `IMEI check: request ${verificationRequestId} is already ${current.status} — skipping`,
      );
      return;
    }

    this.logger.log(
      `Running IMEI checks for listing ${listingId}, IMEI ${maskImei(imei)}, brand=${brand ?? 'unknown'}`,
    );

    let result;
    try {
      result = await this.imeiCheckService.checkImei(imei, brand);
    } catch (err) {
      this.logger.error(
        `checkImei threw for listing ${listingId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      // Write terminal FAILED to Redis + DB so the FE stops polling.
      await this.cacheStatus(verificationRequestId, listingId, 'FAILED', {
        error: (err as Error).message,
      });
      await this.writeTerminalFailure(job);
      return;
    }

    const sanitizedRaw = Object.fromEntries(
      Object.entries(result.rawApiResponse).map(([key, val]) => {
        if (val && typeof val === 'object' && 'price' in (val as object)) {
          const { price: _price, ...rest } = val as Record<string, unknown>;
          return [key, rest];
        }
        return [key, val];
      }),
    );

    await this.prisma.identifierValidation.update({
      where: { verificationRequestId },
      data: {
        imei,
        serialNumber: serialNumber ?? null,
        imeiValid: result.imeiValid,
        serialValid: null,
        icloudLocked: result.icloudLocked,
        reportedStolen: result.reportedStolen,
        blacklisted: result.blacklisted,
        fmiOn: result.fmiOn ?? null,
        rawApiResponse: { ...sanitizedRaw, checksRun: result.checksRun } as any,
        verifiedAt: new Date(),
      },
    });

    const isClean = result.flags.length === 1 && result.flags[0] === 'CLEAN';
    const isNotRun = result.flags.includes('NOT_RUN');
    const newStatus = isClean ? 'PASSED' : isNotRun ? 'PENDING' : 'REQUIRES_REVIEW';
    const integrityFlags = result.flags.filter((f) => f !== 'CLEAN' && f !== 'NOT_RUN');

    const updatedRequest = await this.prisma.verificationRequest.update({
      where: { id: verificationRequestId },
      data: {
        status: newStatus,
        integrityFlags: { set: integrityFlags as any },
        ...(isClean && !current?.completedAt ? { completedAt: new Date() } : {}),
        // When the API key is missing and checks don't run, mark as FAILED
        // so the listing isn't stuck in limbo forever.
        ...(isNotRun ? { completedAt: new Date(), reviewNotes: 'IMEI check could not run — API key may be missing' } : {}),
      },
      select: { sellerId: true },
    });

    if (result.imeiValid) {
      await this.prisma.evidenceChecklist.updateMany({
        where: { verificationRequestId, type: 'SCREENSHOT' },
        data: { fulfilled: true, fulfilledAt: new Date() },
      });
    }

    this.logger.log(
      `IMEI check complete for listing ${listingId} (IMEI ${maskImei(imei)}): status=${newStatus}, flags=[${result.flags.join(', ')}]`,
    );

    await this.cacheStatus(verificationRequestId, listingId, newStatus, {
      integrityFlags,
      imeiValid: result.imeiValid,
      icloudLocked: result.icloudLocked,
      reportedStolen: result.reportedStolen,
      blacklisted: result.blacklisted,
      deviceModel: result.deviceModel ?? null,
      deviceColor: result.deviceColor ?? null,
      deviceStorage: result.deviceStorage ?? null,
      verifiedAt: new Date().toISOString(),
    });

    if (isClean) {
      this.listingSync
        .syncTrustLensResult(listingId, 'PASSED', undefined, [])
        .catch(() => {});
      this.userSync
        .syncVerificationStatus(updatedRequest.sellerId, 'VERIFIED')
        .catch(() => {});
    }
  }
}

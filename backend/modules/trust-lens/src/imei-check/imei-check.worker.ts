import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../../src/database/prisma.service';
import { ImeiCheckService } from './imei-check.service';
import { ListingSyncService } from '../trust-lens/listing-sync.service';
import { UserSyncService } from '../trust-lens/user-sync.service';
import { RedisService } from '@veribuy/redis-cache';

export interface ImeiCheckJob {
  verificationRequestId: string;
  listingId: string;
  imei?: string;
  serialNumber?: string;
  brand?: string;
  /** Number of prior failed attempts — used to cap retries so a failing check
   * cannot loop forever, re-firing paid imeicheck.com requests. */
  attempts?: number;
}

const QUEUE_KEY = 'veribuy:imei-check:queue';
const STATUS_PREFIX = 'veribuy:verification-status';
const STATUS_TTL_SECONDS = 3600;
/** Maximum number of times a job will be attempted before we give up on it. */
const MAX_ATTEMPTS = 2;

/** Mask IMEI for logging — show only last 4 digits. */
function maskImei(imei?: string): string {
  if (!imei) return '[not provided]';
  return `****${imei.slice(-4)}`;
}

/**
 * Drains the Redis-backed IMEI check job queue.
 *
 * Unlike a fire-and-forget background promise (which can be lost if the process
 * is busy, crashes, or the request is interrupted before it runs), jobs are
 * persisted in Redis and consumed by this worker as soon as it is running. This
 * guarantees the imeicheck.com call actually happens even if it is enqueued
 * before the worker is ready.
 */
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
    // Poll with a short delay so a burst of enqueued jobs is processed promptly.
    this.pollTimer = setInterval(() => {
      this.drain().catch((err) =>
        this.logger.error(`IMEI check drain error: ${(err as Error).message}`, (err as Error).stack),
      );
    }, 1000);
    this.logger.log('IMEI check worker started');
  }

  async onModuleDestroy(): Promise<void> {
    this.active = false;
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.logger.log('IMEI check worker stopped');
  }

  /**
   * Enqueue an IMEI check job — persists the request in Redis so it survives
   * worker restarts and is never lost. Returns the number of jobs in the queue.
   */
  async enqueue(job: ImeiCheckJob): Promise<number> {
    const client = this.redis.getClient();
    const serialized = JSON.stringify({ ...job, attempts: job.attempts ?? 0 });
    return await client.rpush(QUEUE_KEY, serialized);
  }

  private async drain(): Promise<void> {
    const client = this.redis.getClient();
    // Non-blocking pop; jobs that cannot be processed stay in the queue and are
    // retried on the next tick (up to MAX_ATTEMPTS). This keeps the process from
    // being wedged by a slow upstream API while bounding how many paid API calls
    // a single failing job can trigger.
    while (this.active) {
      const item = await client.lpop(QUEUE_KEY);
      if (!item) return;
      let job: ImeiCheckJob;
      try {
        job = JSON.parse(item);
      } catch {
        // Malformed job — drop it rather than retry forever.
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
          // Do not silently drop — requeue with an incremented attempt count so a
          // transient failure is retried, but never beyond MAX_ATTEMPTS.
          await client
            .rpush(QUEUE_KEY, JSON.stringify({ ...job, attempts }))
            .catch(() => {});
        } else {
          this.logger.error(
            `IMEI check job for listing ${job.listingId} exceeded MAX_ATTEMPTS — giving up.`,
          );
        }
      }
    }
  }

  /**
   * Reflect an in-progress / completed check outcome so callers (FE) can read it
   * immediately without waiting for a full DB round-trip.
   */
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

  /** Read a cached check outcome (null when absent/expired). */
  async getCachedStatus(listingId: string): Promise<Record<string, unknown> | null> {
    return await this.redis.get<Record<string, unknown>>(`${STATUS_PREFIX}:listing:${listingId}`);
  }

  /**
   * Run the real IMEI Check API (services 3, 4, 5) and write the outcome to
   * IdentifierValidation + VerificationRequest, syncing terminal states onward.
   * Never throws on upstream failure — degrades gracefully and leaves the
   * request in PENDING status.
   */
  async process(job: ImeiCheckJob): Promise<void> {
    const { verificationRequestId, listingId, imei, serialNumber, brand } = job;

    if (!imei) {
      this.logger.warn(
        `IMEI check job without IMEI for listing ${listingId} — skipping`,
      );
      return;
    }

    this.cacheStatus(verificationRequestId, listingId, 'IN_PROGRESS', {});

    // Guard: skip if already in a terminal state set by admin.
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

    const result = await this.imeiCheckService.checkImei(imei, brand);

    // Strip `price` field from rawApiResponse before persisting.
    const sanitizedRaw = Object.fromEntries(
      Object.entries(result.rawApiResponse).map(([key, val]) => {
        if (val && typeof val === 'object' && 'price' in (val as object)) {
          const { price: _price, ...rest } = val as Record<string, unknown>;
          return [key, rest];
        }
        return [key, val];
      }),
    );

    // Write results back to IdentifierValidation.
    await this.prisma.identifierValidation.update({
      where: { verificationRequestId },
      data: {
        imei: imei,
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

    // Update VerificationRequest with flags + new status. Never overwrite
    // completedAt if it was already set (admin may have set it).
    const updatedRequest = await this.prisma.verificationRequest.update({
      where: { id: verificationRequestId },
      data: {
        status: newStatus,
        integrityFlags: { set: integrityFlags as any },
        ...(isClean && !current?.completedAt ? { completedAt: new Date() } : {}),
      },
      select: { sellerId: true },
    });

    // Auto-fulfill the IMEI checklist item (settings screenshot) on a valid check.
    if (result.imeiValid) {
      await this.prisma.evidenceChecklist.updateMany({
        where: { verificationRequestId, type: 'SCREENSHOT' },
        data: { fulfilled: true, fulfilledAt: new Date() },
      });
    }

    this.logger.log(
      `IMEI check complete for listing ${listingId} (IMEI ${maskImei(imei)}): status=${newStatus}, flags=[${result.flags.join(', ')}]`,
    );

    // Cache the outcome for immediate FE read.
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

    // If the check auto-passed, propagate to listing + user services.
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

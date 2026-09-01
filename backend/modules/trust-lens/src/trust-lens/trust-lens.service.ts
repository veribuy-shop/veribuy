import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../src/database/prisma.service';
import { ImeiCheckWorker } from '../imei-check/imei-check.worker';
import { ListingSyncService } from './listing-sync.service';
import { UserSyncService } from './user-sync.service';
import { PaginationDto, PaginatedResponse } from '@veribuy/common';
import { CreateVerificationRequestDto } from './dto/create-verification-request.dto';
import { DeviceType } from '.prisma/veribuy-client';

/** Fields safe to return to sellers (strips rawApiResponse, imei, serialNumber). */
const SELLER_ID_VALIDATION_SELECT = {
  id: true,
  imeiProvided: true,
  imeiValid: true,
  serialProvided: true,
  serialValid: true,
  icloudLocked: true,
  reportedStolen: true,
  blacklisted: true,
  fmiOn: true,
  verifiedAt: true,
  createdAt: true,
  // rawApiResponse intentionally excluded — may contain 3rd-party PII / pricing
  // imei / serialNumber excluded from default seller view
} as const;

@Injectable()
export class TrustLensService {
  private readonly logger = new Logger(TrustLensService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private imeiCheckWorker: ImeiCheckWorker,
    private listingSync: ListingSyncService,
    private userSync: UserSyncService,
  ) {}

  /**
   * Enqueue an IMEI check for a verification request.
   *
   * The job is persisted in a Redis-backed queue and drained by
   * `ImeiCheckWorker`, which calls the real IMEI Check API (services 3, 4, 5),
   * writes results back to IdentifierValidation, and updates the
   * VerificationRequest status. Enqueuing (rather than fire-and-forget) means
   * the check is never lost if the process is busy or restarted.
   */
  async enqueueImeiCheck(data: {
    verificationRequestId: string;
    listingId: string;
    imei?: string;
    serialNumber?: string;
    brand?: string;
  }): Promise<void> {
    try {
      await this.imeiCheckWorker.enqueue({
        verificationRequestId: data.verificationRequestId,
        listingId: data.listingId,
        imei: data.imei,
        serialNumber: data.serialNumber,
        brand: data.brand,
      });
    } catch (err) {
      // Fail open — a Redis outage must not block listing creation. Without the
      // queue the check simply won't run and the request stays PENDING for review.
      this.logger.error(
        `Failed to enqueue IMEI check for listing ${data.listingId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Read the most recently cached IMEI check outcome for a listing, if any.
   * Used by the API so callers can surface the result without a DB round-trip.
   */
  async getCachedImeiStatus(listingId: string): Promise<Record<string, unknown> | null> {
    return await this.imeiCheckWorker.getCachedStatus(listingId);
  }

  async createVerificationRequest(dto: CreateVerificationRequestDto) {
    // Smartphones must be verified against BOTH an IMEI and a serial number.
    // Look up the listing's device type to enforce this server-side.
    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
      select: { deviceType: true },
    });

    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    if (listing.deviceType === DeviceType.SMARTPHONE) {
      if (!dto.imeiProvided || !dto.serialProvided) {
        throw new BadRequestException(
          'Smartphones require both an IMEI and a serial number for verification',
        );
      }
    }

    // Wrap the 4-step creation in a transaction so a partial failure is rolled back
    const result = await this.prisma.$transaction(async (tx) => {
      // Create verification request
      const verificationRequest = await tx.verificationRequest.create({
        data: {
          listingId: dto.listingId,
          sellerId: dto.sellerId,
          conditionGrade: dto.conditionGrade || null,
          status: 'PENDING',
          integrityFlags: [],
        },
      });

      // Create identifier validation if IMEI or serial was provided
      if (dto.imeiProvided || dto.serialProvided) {
        await tx.identifierValidation.create({
          data: {
            verificationRequestId: verificationRequest.id,
            imei: dto.imei ?? null,
            serialNumber: dto.serialNumber ?? null,
            imeiProvided: dto.imeiProvided || false,
            serialProvided: dto.serialProvided || false,
          },
        });
      }

      // Create evidence checklist items (required evidence)
      const checklistItems = [
        { type: 'IMAGE', description: 'Device images (front, back, sides)', required: true },
        { type: 'IMAGE', description: 'Screen images (on, display condition)', required: true },
        { type: 'SCREENSHOT', description: 'Settings screenshot (model, storage)', required: true },
      ];

      await tx.evidenceChecklist.createMany({
        data: checklistItems.map((item) => ({
          verificationRequestId: verificationRequest.id,
          type: item.type as any,
          description: item.description,
          required: item.required,
          fulfilled: false,
        })),
      });

      return verificationRequest;
    });

    // Enqueue the IMEI check for the durable Redis-backed worker (network call
    // runs outside the request). The job persists in Redis so it is never lost.
    if (dto.imeiProvided || dto.serialProvided) {
      await this.enqueueImeiCheck({
        verificationRequestId: result.id,
        listingId: dto.listingId,
        imei: dto.imei,
        serialNumber: dto.serialNumber,
        brand: dto.brand,
      });
    }

    // Fetch and return the complete verification request (seller-safe shape)
    return this.prisma.verificationRequest.findUnique({
      where: { id: result.id },
      include: {
        evidenceChecklist: {
          select: {
            id: true,
            type: true,
            description: true,
            required: true,
            fulfilled: true,
            fulfilledAt: true,
            createdAt: true,
          },
        },
        identifierValidation: {
          select: SELLER_ID_VALIDATION_SELECT,
        },
      },
    });
  }

  async getVerificationRequest(listingId: string) {
    return this.prisma.verificationRequest.findUnique({
      where: { listingId },
      include: {
        evidenceChecklist: {
          select: {
            id: true,
            type: true,
            description: true,
            required: true,
            fulfilled: true,
            fulfilledAt: true,
            createdAt: true,
          },
        },
        identifierValidation: {
          select: SELLER_ID_VALIDATION_SELECT,
        },
      },
    });
  }

  async getAllVerificationRequests(pagination: PaginationDto): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.verificationRequest.findMany({
        skip,
        take: limit,
        include: {
          evidenceChecklist: {
            select: {
              id: true,
              type: true,
              description: true,
              required: true,
              fulfilled: true,
              fulfilledAt: true,
              createdAt: true,
            },
          },
          identifierValidation: {
            select: {
              ...SELLER_ID_VALIDATION_SELECT,
              // Admins get full rawApiResponse for debugging
              rawApiResponse: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.verificationRequest.count(),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Mark EvidenceChecklist items of a given type as fulfilled for a listing.
   * Called internally by evidence-service when files are uploaded.
   *
   * Maps fine-grained evidence-service types to trust-lens checklist types:
   *   IMAGE category  → 'IMAGE'  (DEVICE_IMAGE, SCREEN_IMAGE, BODY_IMAGE, etc.)
   *   SCREENSHOT cat. → 'SCREENSHOT' (SETTINGS_SCREENSHOT, IMEI_SCREENSHOT)
   *   VIDEO category  → 'VIDEO'
   *
   * @param listingId     The listing whose checklist must be updated.
   * @param evidenceType  The fine-grained evidence type from evidence-service.
   */
  async fulfillEvidenceChecklist(listingId: string, evidenceType: string): Promise<void> {
    const verificationRequest = await this.prisma.verificationRequest.findUnique({
      where: { listingId },
      select: { id: true },
    });

    if (!verificationRequest) {
      // No verification request yet — silently skip (evidence may be uploaded before trust-lens)
      this.logger.warn(
        `fulfillEvidenceChecklist: no verification request found for listing ${listingId} — skipping`,
      );
      return;
    }

    // Map fine-grained evidence-service type to trust-lens checklist category
    const checklistType = this.resolveChecklistType(evidenceType);
    if (!checklistType) {
      this.logger.warn(
        `fulfillEvidenceChecklist: unrecognised evidenceType ${evidenceType} for listing ${listingId} — skipping`,
      );
      return;
    }

    await this.prisma.evidenceChecklist.updateMany({
      where: {
        verificationRequestId: verificationRequest.id,
        type: checklistType as any,
        fulfilled: false, // Only update unfulfilled items (idempotent)
      },
      data: {
        fulfilled: true,
        fulfilledAt: new Date(),
      },
    });

    this.logger.log(
      `Fulfilled '${checklistType}' checklist items for listing ${listingId} (evidenceType=${evidenceType})`,
    );
  }

  /** Map an evidence-service EvidenceType string to a trust-lens EvidenceType. */
  private resolveChecklistType(evidenceType: string): string | null {
    const imageTypes = [
      'DEVICE_IMAGE',
      'SCREEN_IMAGE',
      'BODY_IMAGE',
      'PACKAGING_IMAGE',
      'ACCESSORIES_IMAGE',
      'IMAGE',
    ];
    const screenshotTypes = ['SETTINGS_SCREENSHOT', 'IMEI_SCREENSHOT', 'SCREENSHOT'];
    const videoTypes = ['VIDEO'];

    if (imageTypes.includes(evidenceType)) return 'IMAGE';
    if (screenshotTypes.includes(evidenceType)) return 'SCREENSHOT';
    if (videoTypes.includes(evidenceType)) return 'VIDEO';
    return null;
  }

  /** Number of FAILED verification requests before a verified seller is unverified. */
  private static readonly FAILURE_THRESHOLD = 3;

  async updateVerificationStatus(    listingId: string,
    status: 'PENDING' | 'IN_PROGRESS' | 'PASSED' | 'FAILED' | 'REQUIRES_REVIEW',
    reviewNotes?: string,
    integrityFlags?: string[],
  ) {
    const existing = await this.prisma.verificationRequest.findUnique({
      where: { listingId },
      select: { completedAt: true, sellerId: true, conditionGrade: true },
    });
    if (!existing) {
      throw new NotFoundException(`Verification request not found for listing ${listingId}`);
    }

    const isTerminal = status === 'PASSED' || status === 'FAILED';

    const updated = await this.prisma.verificationRequest.update({
      where: { listingId },
      data: {
        status,
        reviewNotes,
        ...(integrityFlags !== undefined
          ? { integrityFlags: { set: integrityFlags as any } }
          : {}),
        // Set completedAt when reaching a terminal state, but never overwrite once set
        ...(isTerminal && !existing.completedAt ? { completedAt: new Date() } : {}),
      },
    });

    // Propagate terminal decisions to listing-service and (on PASSED) user-service.
    // Both are fire-and-forget — errors are logged inside the sync services.
    if (isTerminal) {
      const conditionGrade = updated.conditionGrade ?? undefined;
      const flags = integrityFlags ?? [];

      this.listingSync
        .syncTrustLensResult(
          listingId,
          status as 'PASSED' | 'FAILED',
          conditionGrade as string | undefined,
          flags,
        )
        .catch(() => {});

      if (status === 'PASSED') {
        this.userSync
          .syncVerificationStatus(existing.sellerId, 'VERIFIED')
          .catch(() => {});
      } else if (status === 'FAILED') {
        // Only revoke seller verification after FAILURE_THRESHOLD failed listings.
        // A single bad listing should not unverify a trusted seller.
        const failedCount = await this.prisma.verificationRequest.count({
          where: { sellerId: existing.sellerId, status: 'FAILED' },
        });

        if (failedCount >= TrustLensService.FAILURE_THRESHOLD) {
          this.logger.warn(
            `Seller ${existing.sellerId} has ${failedCount} failed verifications (threshold: ${TrustLensService.FAILURE_THRESHOLD}) — syncing REJECTED`,
          );
          this.userSync
            .syncVerificationStatus(existing.sellerId, 'REJECTED')
            .catch(() => {});
        } else {
          this.logger.log(
            `Seller ${existing.sellerId} has ${failedCount} failed verification(s), below threshold of ${TrustLensService.FAILURE_THRESHOLD} — skipping user status sync`,
          );
        }
      }
    }

    return updated;
  }
}

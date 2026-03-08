import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ImeiCheckService } from '../imei-check/imei-check.service';
import { ListingSyncService } from './listing-sync.service';
import { UserSyncService } from './user-sync.service';
import { PaginationDto, PaginatedResponse } from '@veribuy/common';
import { CreateVerificationRequestDto } from './dto/create-verification-request.dto';

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

/** Mask IMEI for logging — show only last 4 digits. */
function maskImei(imei?: string): string {
  if (!imei) return '[not provided]';
  return `****${imei.slice(-4)}`;
}

@Injectable()
export class TrustLensService {
  private readonly logger = new Logger(TrustLensService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private imeiCheckService: ImeiCheckService,
    private listingSync: ListingSyncService,
    private userSync: UserSyncService,
  ) {}

  /**
   * Calls the real IMEI Check API (services 3, 4, 5 in parallel) and writes
   * results back to IdentifierValidation + merges integrity flags into the
   * VerificationRequest. Also auto-sets the request status:
   *   - All clean  → PASSED  (listing can go ACTIVE)
   *   - Any flag   → REQUIRES_REVIEW (queued for admin)
   * Never throws — on error it logs and leaves the fields null.
   *
   * Guard: if the request is already in a terminal/manually-reviewed state
   * (PASSED, FAILED) we skip overwriting it to avoid clobbering admin decisions.
   */
  private async triggerIdentifierVerification(
    verificationRequestId: string,
    listingId: string,
    imei?: string,
    serialNumber?: string,
    brand?: string,
  ): Promise<void> {
    try {
      if (!imei) {
        this.logger.warn(
          `triggerIdentifierVerification called without IMEI for listing ${listingId} — skipping`,
        );
        return;
      }

      // Guard: skip if already in a terminal state set by admin
      const current = await this.prisma.verificationRequest.findUnique({
        where: { id: verificationRequestId },
        select: { status: true, completedAt: true },
      });
      if (current?.status === 'PASSED' || current?.status === 'FAILED') {
        this.logger.warn(
          `triggerIdentifierVerification: request ${verificationRequestId} is already ${current.status} — skipping`,
        );
        return;
      }

      this.logger.log(
        `Running IMEI checks for listing ${listingId}, IMEI ${maskImei(imei)}, brand=${brand ?? 'unknown'}`,
      );

      const result = await this.imeiCheckService.checkImei(imei, brand);

      // Strip `price` field from rawApiResponse before persisting
      const sanitizedRaw = Object.fromEntries(
        Object.entries(result.rawApiResponse).map(([key, val]) => {
          if (val && typeof val === 'object' && 'price' in (val as object)) {
            const { price: _price, ...rest } = val as Record<string, unknown>;
            return [key, rest];
          }
          return [key, val];
        }),
      );

      // Write results back to IdentifierValidation
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

      // Determine the new verification status.
      // 'CLEAN'   → all checks passed, auto-approve.
      // 'NOT_RUN' → API key not configured, leave as PENDING for manual review.
      // anything else → flags present, route to REQUIRES_REVIEW.
      const isClean = result.flags.length === 1 && result.flags[0] === 'CLEAN';
      const isNotRun = result.flags.includes('NOT_RUN');
      const newStatus = isClean ? 'PASSED' : isNotRun ? 'PENDING' : 'REQUIRES_REVIEW';

      // Build integrity flags (exclude synthetic sentinel values from the stored array)
      const integrityFlags = result.flags.filter((f) => f !== 'CLEAN' && f !== 'NOT_RUN');

      // Update VerificationRequest with flags + new status.
      // Never overwrite completedAt if it was already set (admin may have set it).
      const updatedRequest = await this.prisma.verificationRequest.update({
        where: { id: verificationRequestId },
        data: {
          status: newStatus,
          integrityFlags: { set: integrityFlags as any },
          ...(isClean && !current?.completedAt ? { completedAt: new Date() } : {}),
        },
        select: { sellerId: true },
      });

      // Auto-fulfill the IMEI checklist item (settings screenshot) only when check passed
      if (result.imeiValid) {
        await this.prisma.evidenceChecklist.updateMany({
          where: {
            verificationRequestId,
            type: 'SCREENSHOT',
          },
          data: {
            fulfilled: true,
            fulfilledAt: new Date(),
          },
        });
      }

      this.logger.log(
        `IMEI check complete for listing ${listingId} (IMEI ${maskImei(imei)}): status=${newStatus}, flags=[${result.flags.join(', ')}]`,
      );

      // If IMEI check auto-passed, propagate the result to listing-service and user-service.
      // Both calls are fire-and-forget — errors are logged inside the sync services.
      if (isClean) {
        this.listingSync
          .syncTrustLensResult(listingId, 'PASSED', undefined, [])
          .catch(() => {});
        this.userSync
          .syncVerificationStatus(updatedRequest.sellerId, 'VERIFIED')
          .catch(() => {});
      }
    } catch (error) {
      this.logger.error(
        `triggerIdentifierVerification failed for listing ${listingId}: ${error.message}`,
        error.stack,
      );
      // Intentionally not re-throwing — verification failure must not block listing creation.
    }
  }

  async createVerificationRequest(dto: CreateVerificationRequestDto) {
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

    // Fire-and-forget IMEI check outside the transaction (network call)
    if (dto.imeiProvided || dto.serialProvided) {
      this.triggerIdentifierVerification(
        result.id,
        dto.listingId,
        dto.imei,
        dto.serialNumber,
        dto.brand,
      ).catch((err) => {
        this.logger.error('Background identifier verification error', err?.stack ?? err);
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
        this.userSync
          .syncVerificationStatus(existing.sellerId, 'REJECTED')
          .catch(() => {});
      }
    }

    return updated;
  }
}

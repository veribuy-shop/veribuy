import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ImeiCheckService } from '../imei-check/imei-check.service';
import { PaginationDto, PaginatedResponse } from '@veribuy/common';
import { CreateVerificationRequestDto } from './dto/create-verification-request.dto';

@Injectable()
export class UtrustUlensService {
  private readonly logger = new Logger(UtrustUlensService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private imeiCheckService: ImeiCheckService,
  ) {}

  /**
   * Calls the real IMEI Check API (services 3, 4, 5 in parallel) and writes
   * results back to IdentifierValidation + merges integrity flags into the
   * VerificationRequest. Also auto-sets the request status:
   *   - All clean  → PASSED  (listing can go ACTIVE)
   *   - Any flag   → REQUIRES_REVIEW (queued for admin)
   * Never throws — on error it logs and leaves the fields null.
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

      this.logger.log(`Running IMEI checks for listing ${listingId}, IMEI ${imei}, brand=${brand ?? 'unknown'}`);

      const result = await this.imeiCheckService.checkImei(imei, brand);

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
          rawApiResponse: { ...result.rawApiResponse, checksRun: result.checksRun } as any,
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

      // Update VerificationRequest with flags + new status
      await this.prisma.verificationRequest.update({
        where: { id: verificationRequestId },
        data: {
          status: newStatus,
          integrityFlags: integrityFlags as any,
          completedAt: isClean ? new Date() : null,
        },
      });

      // Auto-fulfill the IMEI checklist item if check passed
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
        `IMEI check complete for listing ${listingId}: status=${newStatus}, flags=[${result.flags.join(', ')}]`,
      );
    } catch (error) {
      this.logger.error(
        `triggerIdentifierVerification failed for listing ${listingId}: ${error.message}`,
        error.stack,
      );
      // Intentionally not re-throwing — verification failure must not block listing creation.
    }
  }

  async createVerificationRequest(dto: CreateVerificationRequestDto) {
    // Create verification request
    const verificationRequest = await this.prisma.verificationRequest.create({
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
      await this.prisma.identifierValidation.create({
        data: {
          verificationRequestId: verificationRequest.id,
          imei: dto.imei ?? null,
          serialNumber: dto.serialNumber ?? null,
          imeiProvided: dto.imeiProvided || false,
          serialProvided: dto.serialProvided || false,
        },
      });

      // Fire-and-forget: trigger real IMEI verification in background
      this.triggerIdentifierVerification(
        verificationRequest.id,
        dto.listingId,
        dto.imei,
        dto.serialNumber,
        dto.brand,
      ).catch((err) => {
        this.logger.error('Background identifier verification error', err?.stack ?? err);
      });
    }

    // Create evidence checklist items (required evidence)
    const checklistItems = [
      { type: 'IMAGE', description: 'Device images (front, back, sides)', required: true },
      { type: 'IMAGE', description: 'Screen images (on, display condition)', required: true },
      { type: 'SCREENSHOT', description: 'Settings screenshot (model, storage)', required: true },
    ];

    await this.prisma.evidenceChecklist.createMany({
      data: checklistItems.map((item) => ({
        verificationRequestId: verificationRequest.id,
        type: item.type as any,
        description: item.description,
        required: item.required,
        fulfilled: false,
      })),
    });

    // Fetch and return the complete verification request
    const result = await this.prisma.verificationRequest.findUnique({
      where: { id: verificationRequest.id },
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
            id: true,
            imei: true,
            serialNumber: true,
            imeiProvided: true,
            imeiValid: true,
            serialProvided: true,
            serialValid: true,
            icloudLocked: true,
            reportedStolen: true,
            blacklisted: true,
            verifiedAt: true,
            createdAt: true,
          },
        },
      },
    });

    return result;
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
          select: {
            id: true,
            imei: true,
            serialNumber: true,
            imeiProvided: true,
            imeiValid: true,
            serialProvided: true,
            serialValid: true,
            icloudLocked: true,
            reportedStolen: true,
            blacklisted: true,
            rawApiResponse: true,
            verifiedAt: true,
            createdAt: true,
          },
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
              id: true,
              imei: true,
              serialNumber: true,
              imeiProvided: true,
              imeiValid: true,
              serialProvided: true,
              serialValid: true,
              icloudLocked: true,
              reportedStolen: true,
              blacklisted: true,
              verifiedAt: true,
              createdAt: true,
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

  async updateVerificationStatus(
    listingId: string,
    status: 'PENDING' | 'IN_PROGRESS' | 'PASSED' | 'FAILED' | 'REQUIRES_REVIEW',
    reviewNotes?: string,
    integrityFlags?: string[],
  ) {
    const result = await this.prisma.verificationRequest.update({
      where: { listingId },
      data: {
        status,
        reviewNotes,
        integrityFlags: integrityFlags as any,
        completedAt: status === 'PASSED' || status === 'FAILED' ? new Date() : null,
      },
    });

    return result;
  }
}

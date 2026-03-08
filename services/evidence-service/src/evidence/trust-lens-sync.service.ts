import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Thin HTTP client that notifies trust-lens-service when evidence is uploaded,
 * so the corresponding EvidenceChecklist items can be marked as fulfilled.
 *
 * Uses the shared INTERNAL_SERVICE_TOKEN for service-to-service auth.
 * Always fire-and-forget — never throws, logs errors only.
 */
@Injectable()
export class TrustLensSyncService {
  private readonly logger = new Logger(TrustLensSyncService.name);
  private readonly url: string;
  private readonly token: string;

  constructor(private configService: ConfigService) {
    this.url =
      this.configService.get<string>('TRUST_LENS_SERVICE_URL') || 'http://localhost:3004';
    this.token = this.configService.get<string>('INTERNAL_SERVICE_TOKEN') || '';

    if (!this.token) {
      this.logger.warn(
        'INTERNAL_SERVICE_TOKEN is not set — trust-lens checklist sync calls will fail',
      );
    }
  }

  /**
   * Notify trust-lens-service that an evidence item of the given type was
   * uploaded for a listing, so the matching checklist items can be fulfilled.
   *
   * @param listingId     The listing the evidence belongs to.
   * @param evidenceType  The fine-grained EvidenceType from evidence-service
   *                      (e.g. DEVICE_IMAGE, SCREEN_IMAGE, IMEI_SCREENSHOT).
   */
  async notifyEvidenceUploaded(listingId: string, evidenceType: string): Promise<void> {
    try {
      const res = await fetch(
        `${this.url}/trust-lens/${listingId}/fulfill-checklist`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-service': this.token,
          },
          body: JSON.stringify({ evidenceType }),
          signal: AbortSignal.timeout(8_000),
        },
      );

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.error(
          `trust-lens-service responded ${res.status} when fulfilling checklist for listing ${listingId} (type=${evidenceType}): ${text}`,
        );
      } else {
        this.logger.log(
          `Notified trust-lens-service of evidence upload for listing ${listingId} (type=${evidenceType})`,
        );
      }
    } catch (err: any) {
      this.logger.error(
        `Failed to notify trust-lens-service for listing ${listingId} (type=${evidenceType}): ${err?.message}`,
        err?.stack,
      );
    }
  }
}

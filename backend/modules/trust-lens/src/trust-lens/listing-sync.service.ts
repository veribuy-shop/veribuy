import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Thin HTTP client that notifies listing-service when a Trust Lens review
 * reaches a terminal state (PASSED / FAILED). Maps ReviewStatus → TrustLensStatus
 * using the listing-service's own enum values.
 *
 * Uses the shared INTERNAL_SERVICE_TOKEN for service-to-service auth.
 * Fire-and-forget on the call-site — never throws, logs errors only.
 */
@Injectable()
export class ListingSyncService {
  private readonly logger = new Logger(ListingSyncService.name);
  private readonly url: string;
  private readonly token: string;

  constructor(private configService: ConfigService) {
    this.url =
      this.configService.get<string>('LISTING_SERVICE_URL') || 'http://localhost:3003';
    this.token = this.configService.get<string>('INTERNAL_SERVICE_TOKEN') || '';

    if (!this.token) {
      this.logger.warn(
        'INTERNAL_SERVICE_TOKEN is not set — listing sync calls will fail',
      );
    }
  }

  /**
   * Sync a terminal Trust Lens review result to the listing-service.
   *
   * @param listingId  The listing whose trustLensStatus must be updated.
   * @param status     'PASSED' or 'FAILED' (only terminal states are synced).
   * @param conditionGrade  Optional condition grade to persist on the listing.
   * @param integrityFlags  Optional integrity flags to persist on the listing.
   */
  async syncTrustLensResult(
    listingId: string,
    status: 'PASSED' | 'FAILED',
    conditionGrade?: string,
    integrityFlags?: string[],
  ): Promise<void> {
    try {
      const body: Record<string, unknown> = {
        trustLensStatus: status,
      };
      if (conditionGrade !== undefined) body['conditionGrade'] = conditionGrade;
      if (integrityFlags !== undefined) body['integrityFlags'] = integrityFlags;

      const res = await fetch(`${this.url}/listings/${listingId}/trust-lens`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service': this.token,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.error(
          `listing-service responded ${res.status} when syncing trust-lens result for listing ${listingId}: ${text}`,
        );
      } else {
        this.logger.log(
          `Synced trust-lens status ${status} to listing ${listingId}`,
        );
      }
    } catch (err: any) {
      this.logger.error(
        `Failed to sync trust-lens result to listing-service for listing ${listingId}: ${err?.message}`,
        err?.stack,
      );
    }
  }
}

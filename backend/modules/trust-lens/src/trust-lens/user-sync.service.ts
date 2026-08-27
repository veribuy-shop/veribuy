import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Thin HTTP client that notifies user-service when a seller's Trust Lens
 * verification reaches a terminal state, advancing their KYC verificationStatus.
 *
 * Uses the shared INTERNAL_SERVICE_TOKEN for service-to-service auth.
 * Fire-and-forget on the call-site — never throws, logs errors only.
 */
@Injectable()
export class UserSyncService {
  private readonly logger = new Logger(UserSyncService.name);
  private readonly url: string;
  private readonly token: string;

  constructor(private configService: ConfigService) {
    this.url =
      this.configService.get<string>('USER_SERVICE_URL') || 'http://localhost:3002';
    this.token = this.configService.get<string>('INTERNAL_SERVICE_TOKEN') || '';

    if (!this.token) {
      this.logger.warn(
        'INTERNAL_SERVICE_TOKEN is not set — user verification sync calls will fail',
      );
    }
  }

  /**
   * Update a seller's KYC verificationStatus in user-service.
   *
   * @param sellerId           The user whose profile must be updated.
   * @param verificationStatus 'VERIFIED' | 'REJECTED' | 'SUSPENDED'
   */
  async syncVerificationStatus(
    sellerId: string,
    verificationStatus: 'VERIFIED' | 'REJECTED' | 'SUSPENDED',
  ): Promise<void> {
    try {
      const res = await fetch(
        `${this.url}/users/${sellerId}/verification-status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-service': this.token,
          },
          body: JSON.stringify({ verificationStatus }),
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.error(
          `user-service responded ${res.status} when syncing verification status for seller ${sellerId}: ${text}`,
        );
      } else {
        this.logger.log(
          `Synced verification status ${verificationStatus} to seller ${sellerId}`,
        );
      }
    } catch (err: any) {
      this.logger.error(
        `Failed to sync verification status to user-service for seller ${sellerId}: ${err?.message}`,
        err?.stack,
      );
    }
  }
}

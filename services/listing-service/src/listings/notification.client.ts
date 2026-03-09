import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationClient {
  private readonly logger = new Logger(NotificationClient.name);
  private readonly baseUrl: string;
  private readonly internalToken: string;

  constructor(private configService: ConfigService) {
    this.baseUrl =
      this.configService.get<string>('NOTIFICATION_SERVICE_URL') ||
      'http://localhost:3008';
    this.internalToken =
      this.configService.get<string>('INTERNAL_SERVICE_TOKEN') || '';
  }

  /**
   * Notify a seller that their listing was submitted successfully.
   * Fire-and-forget — never throws.
   */
  notifyListingCreated(data: {
    sellerEmail: string;
    sellerName: string;
    listingTitle: string;
    listingId: string;
  }): void {
    this.sendEmail('listing_created', data.sellerEmail, {
      sellerName: data.sellerName,
      listingTitle: data.listingTitle,
      listingId: data.listingId,
    }).catch((err) =>
      this.logger.error(`listing_created notification failed: ${err?.message}`),
    );
  }

  /**
   * Notify a seller that the status of their listing changed.
   * Fire-and-forget — never throws.
   */
  notifyListingStatusChanged(data: {
    sellerEmail: string;
    sellerName: string;
    listingTitle: string;
    listingId: string;
    status: string;
    reason?: string;
  }): void {
    this.sendEmail('listing_status', data.sellerEmail, {
      sellerName: data.sellerName,
      listingTitle: data.listingTitle,
      listingId: data.listingId,
      status: data.status,
      reason: data.reason,
    }).catch((err) =>
      this.logger.error(`listing_status notification failed: ${err?.message}`),
    );
  }

  private async sendEmail(
    type: string,
    to: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/notifications/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service': this.internalToken,
      },
      body: JSON.stringify({ type, to, payload }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${response.status} ${body}`);
    }
  }
}

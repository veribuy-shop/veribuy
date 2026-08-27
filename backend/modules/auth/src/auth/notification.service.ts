import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Thin HTTP client that delegates all email sending to notification-service.
 * auth-service has no direct dependency on Resend — notification-service owns
 * all outbound notifications (email, SMS, future push).
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly url: string;
  private readonly token: string;

  constructor(private configService: ConfigService) {
    this.url =
      this.configService.get<string>('NOTIFICATION_SERVICE_URL') ||
      'http://localhost:3008';
    this.token = this.configService.get<string>('INTERNAL_SERVICE_TOKEN') || '';

    if (!this.token) {
      this.logger.warn('INTERNAL_SERVICE_TOKEN is not set — notification calls will fail');
    }
  }

  async sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
    await this.dispatch({ type: 'verification', to, payload: { name, token } });
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    await this.dispatch({ type: 'welcome', to, payload: { name } });
  }

  async sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
    await this.dispatch({ type: 'password_reset', to, payload: { name, token } });
  }

  private async dispatch(body: {
    type: string;
    to: string;
    payload: Record<string, any>;
  }): Promise<void> {
    try {
      const res = await fetch(`${this.url}/notifications/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service': this.token,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        this.logger.error(
          `notification-service responded ${res.status} for type=${body.type} to=${body.to}: ${text}`,
        );
      }
    } catch (err: any) {
      // Fire-and-forget — log but never crash auth-service
      this.logger.error(
        `Failed to reach notification-service for type=${body.type} to=${body.to}: ${err?.message}`,
      );
    }
  }
}

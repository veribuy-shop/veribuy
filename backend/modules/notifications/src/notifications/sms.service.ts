import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';

/**
 * SmsService — scaffolded, not yet active.
 *
 * Planned triggers (wire up when ready):
 *   - Email/phone verification OTP
 *   - Order placed / confirmed (buyer)
 *   - Order status updates (buyer + seller)
 *   - Trust Lens result (seller)
 *
 * Required env vars (Railway → notification-service):
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_PHONE_NUMBER   (e.g. +15005550006 for test, real number for prod)
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private client: ReturnType<typeof twilio> | null = null;
  private readonly from: string;

  constructor(private configService: ConfigService) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    this.from = this.configService.get<string>('TWILIO_PHONE_NUMBER') || '';

    if (accountSid && authToken && this.from) {
      this.client = twilio(accountSid, authToken);
    } else {
      this.logger.warn(
        'Twilio env vars not set (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER) — SMS sending is disabled',
      );
    }
  }

  // ─── Verification OTP ────────────────────────────────────────────────────────

  async sendVerificationOtp(to: string, otp: string): Promise<void> {
    await this.send(to, `Your VeriBuy verification code is: ${otp}. It expires in 10 minutes.`);
  }

  // ─── Order Notifications ─────────────────────────────────────────────────────

  async sendOrderConfirmation(to: string, orderId: string, amount: string): Promise<void> {
    await this.send(
      to,
      `VeriBuy: Your order ${orderId} is confirmed. Amount: ${amount} is in escrow. View at ${this.appUrl()}/orders`,
    );
  }

  async sendOrderStatusUpdate(to: string, orderId: string, status: string): Promise<void> {
    await this.send(
      to,
      `VeriBuy: Order ${orderId} status updated to ${status}. View at ${this.appUrl()}/orders`,
    );
  }

  // ─── Trust Lens ──────────────────────────────────────────────────────────────

  async sendTrustLensResult(to: string, listingTitle: string, passed: boolean): Promise<void> {
    const result = passed ? 'PASSED' : 'FAILED';
    await this.send(
      to,
      `VeriBuy: Trust Lens verification for "${listingTitle}" has ${result}. Log in to view details.`,
    );
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private async send(to: string, body: string): Promise<void> {
    if (!this.client) {
      this.logger.warn(`SMS skipped (no Twilio config): to=${to} body="${body.substring(0, 40)}..."`);
      return;
    }

    try {
      await this.client.messages.create({ from: this.from, to, body });
      this.logger.log(`SMS sent: to=${to}`);
    } catch (err: any) {
      this.logger.error(`Failed to send SMS to ${to}: ${err?.message}`);
    }
  }

  private appUrl(): string {
    return this.configService.get<string>('APP_URL') || 'https://dev.veribuy.shop';
  }
}

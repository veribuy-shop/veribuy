import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private readonly from: string;
  private readonly appUrl: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.from = this.configService.get<string>('EMAIL_FROM') || 'VeriBuy <noreply@veribuy.shop>';
    this.appUrl = this.configService.get<string>('APP_URL') || 'https://dev.veribuy.shop';

    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn('RESEND_API_KEY is not set — email sending is disabled');
    }
  }

  // ─── Email Verification ──────────────────────────────────────────────────────

  async sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
    const link = `${this.appUrl}/verify-email?token=${token}`;
    await this.send({
      to,
      subject: 'Verify your VeriBuy email address',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#1a56db">Verify your email address</h2>
          <p>Hi ${this.escape(name)},</p>
          <p>Thanks for creating your VeriBuy account. Please verify your email address by clicking the button below.</p>
          <p style="margin:32px 0">
            <a href="${link}" style="background:#1a56db;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
              Verify Email Address
            </a>
          </p>
          <p style="color:#6b7280;font-size:14px">This link expires in 24 hours. If you did not create an account, you can safely ignore this email.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="color:#9ca3af;font-size:12px">VeriBuy — Verified Electronics Marketplace</p>
        </div>
      `,
    });
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    await this.send({
      to,
      subject: 'Welcome to VeriBuy!',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#1a56db">Welcome to VeriBuy, ${this.escape(name)}!</h2>
          <p>Your email has been verified and your account is ready to use.</p>
          <p style="margin:32px 0">
            <a href="${this.appUrl}/dashboard" style="background:#1a56db;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
              Go to Dashboard
            </a>
          </p>
          <p style="color:#6b7280;font-size:14px">
            Whether you're buying or selling verified electronics, we're here to make the experience safe and transparent.
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="color:#9ca3af;font-size:12px">VeriBuy — Verified Electronics Marketplace</p>
        </div>
      `,
    });
  }

  // ─── Password Reset ──────────────────────────────────────────────────────────

  async sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
    const link = `${this.appUrl}/reset-password?token=${token}`;
    await this.send({
      to,
      subject: 'Reset your VeriBuy password',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#1a56db">Reset your password</h2>
          <p>Hi ${this.escape(name)},</p>
          <p>We received a request to reset your VeriBuy password. Click the button below to choose a new password.</p>
          <p style="margin:32px 0">
            <a href="${link}" style="background:#1a56db;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
              Reset Password
            </a>
          </p>
          <p style="color:#6b7280;font-size:14px">This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email — your password will not change.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="color:#9ca3af;font-size:12px">VeriBuy — Verified Electronics Marketplace</p>
        </div>
      `,
    });
  }

  // ─── Contact Us ──────────────────────────────────────────────────────────────

  async sendContactUsEmail(data: {
    fromName: string;
    fromEmail: string;
    subject: string;
    message: string;
  }): Promise<void> {
    await this.send({
      to: 'veribuy.shop@gmail.com',
      replyTo: data.fromEmail,
      subject: `[Contact Us] ${data.subject}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#1a56db">New Contact Us Message</h2>
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
            <tr><td style="color:#6b7280;width:100px;padding:4px 0">From:</td><td><strong>${this.escape(data.fromName)}</strong> &lt;${this.escape(data.fromEmail)}&gt;</td></tr>
            <tr><td style="color:#6b7280;padding:4px 0">Subject:</td><td>${this.escape(data.subject)}</td></tr>
          </table>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;white-space:pre-wrap">${this.escape(data.message)}</div>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="color:#9ca3af;font-size:12px">VeriBuy — Verified Electronics Marketplace</p>
        </div>
      `,
    });

    // Also send an acknowledgement to the sender
    await this.send({
      to: data.fromEmail,
      subject: 'We received your message — VeriBuy Support',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#1a56db">We got your message, ${this.escape(data.fromName)}!</h2>
          <p>Thank you for reaching out. Our team will get back to you within 24 hours.</p>
          <p style="color:#6b7280;font-size:14px">Your message:</p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;white-space:pre-wrap;color:#374151;font-size:14px">${this.escape(data.message)}</div>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="color:#9ca3af;font-size:12px">VeriBuy — Verified Electronics Marketplace | <a href="mailto:veribuy.shop@gmail.com" style="color:#9ca3af">veribuy.shop@gmail.com</a></p>
        </div>
      `,
    });
  }

  // ─── Contact Seller ──────────────────────────────────────────────────────────

  async sendContactSellerEmail(data: {
    sellerEmail: string;
    sellerName: string;
    buyerName: string;
    listingTitle: string;
    subject: string;
    message: string;
    listingId: string;
  }): Promise<void> {
    const listingUrl = `${this.appUrl}/listings/${data.listingId}`;
    await this.send({
      to: data.sellerEmail,
      subject: `[VeriBuy] New inquiry: ${data.subject}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#1a56db">New inquiry about your listing</h2>
          <p><strong>${this.escape(data.buyerName)}</strong> sent you a message about <a href="${listingUrl}" style="color:#1a56db">${this.escape(data.listingTitle)}</a>.</p>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin:16px 0;white-space:pre-wrap">${this.escape(data.message)}</div>
          <p style="margin:24px 0">
            <a href="${this.appUrl}/dashboard" style="background:#1a56db;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
              Reply in VeriBuy
            </a>
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="color:#9ca3af;font-size:12px">VeriBuy — Verified Electronics Marketplace</p>
        </div>
      `,
    });
  }

  // ─── Order Notifications ─────────────────────────────────────────────────────

  async sendOrderConfirmationEmail(data: {
    buyerEmail: string;
    buyerName: string;
    listingTitle: string;
    orderId: string;
    amount: string;
  }): Promise<void> {
    await this.send({
      to: data.buyerEmail,
      subject: 'Your VeriBuy order is confirmed',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#1a56db">Order Confirmed</h2>
          <p>Hi ${this.escape(data.buyerName)},</p>
          <p>Your order has been placed successfully and is now in escrow.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="color:#6b7280;padding:4px 0">Order ID:</td><td><code>${this.escape(data.orderId)}</code></td></tr>
            <tr><td style="color:#6b7280;padding:4px 0">Item:</td><td>${this.escape(data.listingTitle)}</td></tr>
            <tr><td style="color:#6b7280;padding:4px 0">Amount:</td><td><strong>${this.escape(data.amount)}</strong></td></tr>
          </table>
          <p style="margin:24px 0">
            <a href="${this.appUrl}/orders" style="background:#1a56db;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
              View Order
            </a>
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="color:#9ca3af;font-size:12px">VeriBuy — Verified Electronics Marketplace</p>
        </div>
      `,
    });
  }

  async sendOrderStatusEmail(data: {
    recipientEmail: string;
    recipientName: string;
    listingTitle: string;
    orderId: string;
    status: string;
    message: string;
  }): Promise<void> {
    await this.send({
      to: data.recipientEmail,
      subject: `Your VeriBuy order status: ${data.status}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#1a56db">Order Update</h2>
          <p>Hi ${this.escape(data.recipientName)},</p>
          <p>${this.escape(data.message)}</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="color:#6b7280;padding:4px 0">Order ID:</td><td><code>${this.escape(data.orderId)}</code></td></tr>
            <tr><td style="color:#6b7280;padding:4px 0">Item:</td><td>${this.escape(data.listingTitle)}</td></tr>
            <tr><td style="color:#6b7280;padding:4px 0">Status:</td><td><strong>${this.escape(data.status)}</strong></td></tr>
          </table>
          <p style="margin:24px 0">
            <a href="${this.appUrl}/orders" style="background:#1a56db;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
              View Order
            </a>
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="color:#9ca3af;font-size:12px">VeriBuy — Verified Electronics Marketplace</p>
        </div>
      `,
    });
  }

  // ─── Listing Notifications ───────────────────────────────────────────────────

  async sendListingCreatedEmail(data: {
    sellerEmail: string;
    sellerName: string;
    listingTitle: string;
    listingId: string;
  }): Promise<void> {
    const listingUrl = `${this.appUrl}/dashboard/listings/${data.listingId}`;
    await this.send({
      to: data.sellerEmail,
      subject: 'Your listing has been submitted — VeriBuy',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#1a56db">Listing Submitted</h2>
          <p>Hi ${this.escape(data.sellerName)},</p>
          <p>Your listing <strong>${this.escape(data.listingTitle)}</strong> has been submitted and is currently under review. We'll notify you once it goes live.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="color:#6b7280;padding:4px 0">Status:</td><td><strong>Under Review</strong></td></tr>
          </table>
          <p style="margin:24px 0">
            <a href="${listingUrl}" style="background:#1a56db;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
              View Listing
            </a>
          </p>
          <p style="color:#6b7280;font-size:14px">Our team will review your listing shortly. This usually takes less than 24 hours.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="color:#9ca3af;font-size:12px">VeriBuy — Verified Electronics Marketplace</p>
        </div>
      `,
    });
  }

  async sendListingStatusEmail(data: {
    sellerEmail: string;
    sellerName: string;
    listingTitle: string;
    listingId: string;
    status: string;
    reason?: string;
  }): Promise<void> {
    const listingUrl = `${this.appUrl}/dashboard/listings/${data.listingId}`;

    const statusConfig: Record<string, { label: string; color: string; message: string }> = {
      ACTIVE:    { label: 'Active',    color: '#16a34a', message: 'Great news — your listing has been approved and is now live on VeriBuy.' },
      REJECTED:  { label: 'Rejected',  color: '#dc2626', message: 'Unfortunately your listing did not meet our listing requirements and has been rejected.' },
      DELISTED:  { label: 'Delisted',  color: '#d97706', message: 'Your listing has been delisted and is no longer visible to buyers.' },
      SOLD:      { label: 'Sold',      color: '#1a56db', message: 'Congratulations — your listing has been marked as sold!' },
      UNDER_REVIEW: { label: 'Under Review', color: '#7c3aed', message: 'Your listing has been submitted for review.' },
      DRAFT:     { label: 'Draft',     color: '#6b7280', message: 'Your listing has been moved back to draft.' },
    };

    const cfg = statusConfig[data.status] ?? { label: data.status, color: '#6b7280', message: `Your listing status has been updated to ${data.status}.` };

    await this.send({
      to: data.sellerEmail,
      subject: `Listing update: ${cfg.label} — VeriBuy`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:${cfg.color}">Listing ${cfg.label}</h2>
          <p>Hi ${this.escape(data.sellerName)},</p>
          <p>${cfg.message}</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="color:#6b7280;padding:4px 0">Listing:</td><td><strong>${this.escape(data.listingTitle)}</strong></td></tr>
            <tr><td style="color:#6b7280;padding:4px 0">Status:</td><td style="color:${cfg.color};font-weight:600">${cfg.label}</td></tr>
            ${data.reason ? `<tr><td style="color:#6b7280;padding:4px 0">Reason:</td><td>${this.escape(data.reason)}</td></tr>` : ''}
          </table>
          <p style="margin:24px 0">
            <a href="${listingUrl}" style="background:#1a56db;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
              View Listing
            </a>
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="color:#9ca3af;font-size:12px">VeriBuy — Verified Electronics Marketplace</p>
        </div>
      `,
    });
  }

  // ─── Trust Lens ──────────────────────────────────────────────────────────────

  async sendTrustLensResultEmail(data: {
    sellerEmail: string;
    sellerName: string;
    listingTitle: string;
    listingId: string;
    passed: boolean;
    conditionGrade?: string;
    notes?: string;
  }): Promise<void> {
    const listingUrl = `${this.appUrl}/listings/${data.listingId}`;
    const statusColor = data.passed ? '#16a34a' : '#dc2626';
    const statusText = data.passed ? 'Passed' : 'Failed';

    await this.send({
      to: data.sellerEmail,
      subject: `Trust Lens result for your listing: ${statusText}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:${statusColor}">Trust Lens ${statusText}</h2>
          <p>Hi ${this.escape(data.sellerName)},</p>
          <p>The Trust Lens verification for <a href="${listingUrl}" style="color:#1a56db">${this.escape(data.listingTitle)}</a> has completed.</p>
          <table style="width:100%;border-collapse:collapse;margin:16px 0">
            <tr><td style="color:#6b7280;padding:4px 0">Result:</td><td style="color:${statusColor};font-weight:600">${statusText}</td></tr>
            ${data.conditionGrade ? `<tr><td style="color:#6b7280;padding:4px 0">Condition Grade:</td><td><strong>${this.escape(data.conditionGrade)}</strong></td></tr>` : ''}
            ${data.notes ? `<tr><td style="color:#6b7280;padding:4px 0">Notes:</td><td>${this.escape(data.notes)}</td></tr>` : ''}
          </table>
          <p style="margin:24px 0">
            <a href="${listingUrl}" style="background:#1a56db;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
              View Listing
            </a>
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="color:#9ca3af;font-size:12px">VeriBuy — Verified Electronics Marketplace</p>
        </div>
      `,
    });
  }

  // ─── Generic send ─────────────────────────────────────────────────────────────

  async sendRaw(data: {
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
  }): Promise<void> {
    await this.send(data);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private async send(data: {
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
  }): Promise<void> {
    if (!this.resend) {
      this.logger.warn(`Email skipped (no API key): to=${data.to} subject="${data.subject}"`);
      return;
    }

    try {
      const payload: any = {
        from: this.from,
        to: data.to,
        subject: data.subject,
        html: data.html,
      };
      if (data.replyTo) payload.reply_to = data.replyTo;

      const { error } = await this.resend.emails.send(payload);
      if (error) {
        this.logger.error(`Resend error: ${JSON.stringify(error)} | to=${data.to}`);
      } else {
        this.logger.log(`Email sent: to=${data.to} subject="${data.subject}"`);
      }
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${data.to}: ${err?.message}`);
    }
  }

  private escape(str: string): string {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

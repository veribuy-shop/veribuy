import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

interface EmailLayoutOptions {
  title: string;
  previewText?: string;
  badgeText?: string;
  badgeType?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  bodyHtml: string;
  cta?: {
    label: string;
    url: string;
  };
  secondaryText?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;
  private readonly from: string;
  private readonly appUrl: string;
  private readonly contactEmail: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.from = this.configService.get<string>('EMAIL_FROM') || 'VeriBuy <noreply@veribuy.shop>';
    this.appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:3010';
    this.contactEmail =
      this.configService.get<string>('CONTACT_EMAIL') || 'veribuy.shop@gmail.com';

    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn('RESEND_API_KEY is not set — email sending is disabled');
    }
  }

  // ─── Email Layout Helper ──────────────────────────────────────────────────────

  private buildEmailTemplate(options: EmailLayoutOptions): string {
    const { title, previewText, badgeText, badgeType = 'success', bodyHtml, cta, secondaryText } = options;

    const badgeColors: Record<string, { bg: string; text: string; border: string }> = {
      success: { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0' },
      warning: { bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
      danger:  { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
      info:    { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' },
      neutral: { bg: '#f3f4f6', text: '#374151', border: '#e5e7eb' },
    };

    const currentBadge = badgeColors[badgeType] || badgeColors.success;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escape(title)}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td, a { font-family: Arial, Helvetica, sans-serif !important; }
  </style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;line-height:1.6;color:#1e293b;">
  ${previewText ? `<div style="display:none;font-size:1px;color:#0f172a;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${this.escape(previewText)}</div>` : ''}
  
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#0f172a;padding:32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 25px -5px rgba(0,0,0,0.3);border:1px solid #1e293b;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color:#022c22;background:linear-gradient(135deg, #022c22 0%, #064e3b 100%);padding:28px 32px;text-align:left;border-bottom:2px solid #059669;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="display:inline-block;vertical-align:middle;">
                      <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;text-decoration:none;">
                        Veri<span style="color:#34d399;">Buy</span>
                      </span>
                    </div>
                  </td>
                  <td align="right">
                    <span style="font-size:11px;font-weight:600;color:#a7f3d0;text-transform:uppercase;letter-spacing:1px;background-color:rgba(6,78,59,0.7);padding:4px 10px;border-radius:20px;border:1px solid rgba(52,211,153,0.3);">
                      Verified Escrow
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding:36px 32px 28px 32px;background-color:#ffffff;">
              ${badgeText ? `
              <div style="margin-bottom:16px;">
                <span style="display:inline-block;font-size:12px;font-weight:700;color:${currentBadge.text};background-color:${currentBadge.bg};border:1px solid ${currentBadge.border};padding:4px 12px;border-radius:100px;">
                  ${this.escape(badgeText)}
                </span>
              </div>
              ` : ''}

              <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:800;color:#0f172a;letter-spacing:-0.3px;line-height:1.3;">
                ${this.escape(title)}
              </h1>

              <div style="font-size:15px;color:#334155;line-height:1.65;">
                ${bodyHtml}
              </div>

              ${cta ? `
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:32px 0 24px 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="border-radius:10px;background-color:#059669;">
                          <a href="${this.escape(cta.url)}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;background-color:#059669;border:1px solid #047857;letter-spacing:0.2px;">
                            ${this.escape(cta.label)} &rarr;
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              ` : ''}

              ${secondaryText ? `
              <div style="margin-top:24px;padding-top:20px;border-top:1px solid #f1f5f9;font-size:13px;color:#64748b;line-height:1.5;">
                ${secondaryText}
              </div>
              ` : ''}
            </td>
          </tr>

          <!-- Security Callout & Footer -->
          <tr>
            <td style="background-color:#f8fafc;padding:24px 32px;border-top:1px solid #e2e8f0;text-align:center;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center" style="padding-bottom:12px;">
                    <span style="font-size:12px;font-weight:600;color:#059669;">
                      &#128737; Protected by VeriBuy Trust Lens&trade; & 100% Escrow Guarantee
                    </span>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="font-size:12px;color:#94a3b8;line-height:1.5;">
                    Need help? Contact our support team at <a href="mailto:${this.contactEmail}" style="color:#059669;text-decoration:none;font-weight:600;">${this.contactEmail}</a><br>
                    &copy; ${new Date().getFullYear()} VeriBuy Inc. All rights reserved.
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();
  }

  // ─── Email Verification ──────────────────────────────────────────────────────

  async sendVerificationEmail(to: string, name: string, token: string): Promise<void> {
    const link = `${this.appUrl}/verify-email?token=${token}`;
    const bodyHtml = `
      <p style="margin-top:0;">Hi <strong>${this.escape(name)}</strong>,</p>
      <p>Thanks for creating an account on VeriBuy. To ensure a safe marketplace for verified electronics, please verify your email address to activate your account.</p>
      
      <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin:20px 0;">
        <p style="margin:0;font-size:13px;color:#475569;">
          <strong>Why verification matters:</strong> VeriBuy requires verified accounts to prevent fraudulent listings, protect escrow disbursements, and ensure cryptographic Trust Lens&trade; device tracking.
        </p>
      </div>
    `;

    const html = this.buildEmailTemplate({
      title: 'Verify your VeriBuy account',
      previewText: 'Click the link to verify your email address and activate your account.',
      badgeText: 'Action Required',
      badgeType: 'info',
      bodyHtml,
      cta: {
        label: 'Verify Email Address',
        url: link,
      },
      secondaryText: 'This verification link will expire in 24 hours. If you did not sign up for VeriBuy, you can safely disregard this email.',
    });

    await this.send({
      to,
      subject: 'Verify your VeriBuy email address',
      html,
    });
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    const bodyHtml = `
      <p style="margin-top:0;">Hi <strong>${this.escape(name)}</strong>,</p>
      <p>Your email has been successfully verified! Welcome to the safest marketplace for buying and selling electronics with certified hardware verification.</p>
      
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:20px 0;">
        <tr>
          <td style="padding:12px;background-color:#f8fafc;border-radius:8px;border-left:3px solid #059669;margin-bottom:8px;">
            <strong style="color:#0f172a;font-size:14px;">Looking to Buy?</strong>
            <div style="font-size:13px;color:#475569;margin-top:2px;">Every device is checked against GSMA blacklists and backed by our vaulted escrow protection.</div>
          </td>
        </tr>
        <tr><td style="height:10px;"></td></tr>
        <tr>
          <td style="padding:12px;background-color:#f8fafc;border-radius:8px;border-left:3px solid #059669;">
            <strong style="color:#0f172a;font-size:14px;">Looking to Sell?</strong>
            <div style="font-size:13px;color:#475569;margin-top:2px;">Enjoy 0% seller commission fees, instant IMEI autofill, and guaranteed escrow payouts.</div>
          </td>
        </tr>
      </table>
    `;

    const html = this.buildEmailTemplate({
      title: `Welcome to VeriBuy, ${this.escape(name)}!`,
      previewText: 'Your account is ready. Start exploring verified electronics.',
      badgeText: 'Account Verified',
      badgeType: 'success',
      bodyHtml,
      cta: {
        label: 'Go to Your Dashboard',
        url: `${this.appUrl}/dashboard`,
      },
    });

    await this.send({
      to,
      subject: 'Welcome to VeriBuy!',
      html,
    });
  }

  // ─── Password Reset ──────────────────────────────────────────────────────────

  async sendPasswordResetEmail(to: string, name: string, token: string): Promise<void> {
    const link = `${this.appUrl}/reset-password?token=${token}`;
    const bodyHtml = `
      <p style="margin-top:0;">Hi <strong>${this.escape(name)}</strong>,</p>
      <p>We received a request to reset the password associated with your VeriBuy account. Click the button below to choose a secure new password.</p>
      
      <div style="background-color:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px;margin:20px 0;">
        <p style="margin:0;font-size:13px;color:#92400e;">
          &#9888; <strong>Security Notice:</strong> This link is single-use and will expire in 1 hour. Never share this link with anyone.
        </p>
      </div>
    `;

    const html = this.buildEmailTemplate({
      title: 'Reset Your Password',
      previewText: 'Instructions to reset your VeriBuy account password.',
      badgeText: 'Security Notice',
      badgeType: 'warning',
      bodyHtml,
      cta: {
        label: 'Reset Password',
        url: link,
      },
      secondaryText: 'If you did not request a password reset, you can safely ignore this email — your existing password remains unchanged and secure.',
    });

    await this.send({
      to,
      subject: 'Reset your VeriBuy password',
      html,
    });
  }

  // ─── Contact Us ──────────────────────────────────────────────────────────────

  async sendContactUsEmail(data: {
    fromName: string;
    fromEmail: string;
    subject: string;
    message: string;
  }): Promise<void> {
    const adminBodyHtml = `
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;font-size:14px;">
        <tr><td style="color:#64748b;width:90px;padding:6px 0;">Sender:</td><td><strong>${this.escape(data.fromName)}</strong> &lt;${this.escape(data.fromEmail)}&gt;</td></tr>
        <tr><td style="color:#64748b;padding:6px 0;">Subject:</td><td><strong>${this.escape(data.subject)}</strong></td></tr>
      </table>
      <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:18px;white-space:pre-wrap;font-size:14px;color:#1e293b;line-height:1.6;">${this.escape(data.message)}</div>
    `;

    const adminHtml = this.buildEmailTemplate({
      title: 'New Customer Support Inquiry',
      badgeText: 'Inquiry',
      badgeType: 'info',
      bodyHtml: adminBodyHtml,
      cta: {
        label: 'Reply via Email',
        url: `mailto:${data.fromEmail}?subject=Re: ${encodeURIComponent(data.subject)}`,
      },
    });

    await this.send({
      to: this.contactEmail,
      replyTo: data.fromEmail,
      subject: `[Contact Us] ${data.subject}`,
      html: adminHtml,
    });

    // Sender acknowledgement
    const userBodyHtml = `
      <p style="margin-top:0;">Hi <strong>${this.escape(data.fromName)}</strong>,</p>
      <p>Thank you for reaching out to VeriBuy Support. We have received your message and our dedicated team is already reviewing it. We aim to respond within 24 hours.</p>
      <p style="font-size:13px;color:#64748b;margin-bottom:6px;"><strong>Your message summary:</strong></p>
      <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;font-size:13px;color:#334155;white-space:pre-wrap;line-height:1.5;">${this.escape(data.message)}</div>
    `;

    const userHtml = this.buildEmailTemplate({
      title: 'We Received Your Message',
      previewText: 'Thank you for contacting VeriBuy Support. We will get back to you shortly.',
      badgeText: 'Message Received',
      badgeType: 'success',
      bodyHtml: userBodyHtml,
      cta: {
        label: 'Visit Help Center',
        url: `${this.appUrl}/help`,
      },
    });

    await this.send({
      to: data.fromEmail,
      subject: 'We received your message — VeriBuy Support',
      html: userHtml,
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
    const bodyHtml = `
      <p style="margin-top:0;">Hi <strong>${this.escape(data.sellerName)}</strong>,</p>
      <p><strong>${this.escape(data.buyerName)}</strong> has sent you a direct message regarding your listing: <strong style="color:#059669;">${this.escape(data.listingTitle)}</strong>.</p>
      
      <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin:20px 0;font-size:14px;color:#1e293b;white-space:pre-wrap;line-height:1.6;">${this.escape(data.message)}</div>
    `;

    const html = this.buildEmailTemplate({
      title: `New Buyer Inquiry: ${this.escape(data.subject)}`,
      previewText: `${data.buyerName} sent an inquiry about ${data.listingTitle}`,
      badgeText: 'Listing Message',
      badgeType: 'info',
      bodyHtml,
      cta: {
        label: 'Reply in VeriBuy',
        url: `${this.appUrl}/dashboard`,
      },
      secondaryText: `You can view the full listing details anytime at <a href="${listingUrl}" style="color:#059669;">${listingUrl}</a>.`,
    });

    await this.send({
      to: data.sellerEmail,
      subject: `[VeriBuy] New inquiry: ${data.subject}`,
      html,
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
    const bodyHtml = `
      <p style="margin-top:0;">Hi <strong>${this.escape(data.buyerName)}</strong>,</p>
      <p>Your order has been confirmed! Your payment is now securely vaulted in <strong>VeriBuy Escrow</strong> and will not be disbursed until you receive and inspect your device.</p>
      
      <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin:24px 0;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size:14px;">
          <tr>
            <td style="color:#64748b;padding:6px 0;">Order Reference:</td>
            <td align="right" style="font-family:monospace;font-weight:700;color:#0f172a;">#${this.escape(data.orderId.substring(0, 12))}</td>
          </tr>
          <tr>
            <td style="color:#64748b;padding:6px 0;">Item:</td>
            <td align="right" style="font-weight:600;color:#0f172a;">${this.escape(data.listingTitle)}</td>
          </tr>
          <tr style="border-top:1px solid #e2e8f0;">
            <td style="color:#0f172a;font-weight:700;padding:10px 0 0 0;">Total Paid:</td>
            <td align="right" style="font-size:16px;font-weight:800;color:#059669;padding:10px 0 0 0;">${this.escape(data.amount)}</td>
          </tr>
        </table>
      </div>

      <div style="background-color:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:14px;font-size:13px;color:#065f46;">
        &#10004; <strong>What happens next:</strong> The seller has been notified to pack and dispatch your item via tracked courier. You will receive tracking details as soon as it ships.
      </div>
    `;

    const html = this.buildEmailTemplate({
      title: 'Order Confirmed & Escrow Secured',
      previewText: `Order #${data.orderId.substring(0, 8)} confirmed. Payment secured in escrow.`,
      badgeText: 'Payment Vaulted',
      badgeType: 'success',
      bodyHtml,
      cta: {
        label: 'Track Order & Escrow',
        url: `${this.appUrl}/orders/${data.orderId}/tracking`,
      },
    });

    await this.send({
      to: data.buyerEmail,
      subject: 'Your VeriBuy order is confirmed',
      html,
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
    const statusBadges: Record<string, { label: string; type: 'success' | 'info' | 'warning' | 'danger' }> = {
      SHIPPED: { label: 'In Transit', type: 'info' },
      DELIVERED: { label: 'Delivered', type: 'success' },
      COMPLETED: { label: 'Completed', type: 'success' },
      CANCELLED: { label: 'Cancelled', type: 'danger' },
      REFUNDED: { label: 'Refunded', type: 'warning' },
      DISPUTED: { label: 'Dispute Open', type: 'warning' },
    };

    const current = statusBadges[data.status] || { label: data.status, type: 'info' };

    const bodyHtml = `
      <p style="margin-top:0;">Hi <strong>${this.escape(data.recipientName)}</strong>,</p>
      <p>${this.escape(data.message)}</p>
      
      <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin:24px 0;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size:14px;">
          <tr>
            <td style="color:#64748b;padding:6px 0;">Order Reference:</td>
            <td align="right" style="font-family:monospace;font-weight:700;color:#0f172a;">#${this.escape(data.orderId.substring(0, 12))}</td>
          </tr>
          <tr>
            <td style="color:#64748b;padding:6px 0;">Item:</td>
            <td align="right" style="font-weight:600;color:#0f172a;">${this.escape(data.listingTitle)}</td>
          </tr>
          <tr>
            <td style="color:#64748b;padding:6px 0;">Updated Status:</td>
            <td align="right" style="font-weight:700;color:#059669;">${this.escape(current.label)}</td>
          </tr>
        </table>
      </div>
    `;

    const html = this.buildEmailTemplate({
      title: 'Order Status Update',
      previewText: `Order #${data.orderId.substring(0, 8)}: ${data.message}`,
      badgeText: current.label,
      badgeType: current.type,
      bodyHtml,
      cta: {
        label: 'View Order Timeline',
        url: `${this.appUrl}/orders/${data.orderId}/tracking`,
      },
    });

    await this.send({
      to: data.recipientEmail,
      subject: `Your VeriBuy order status: ${current.label}`,
      html,
    });
  }

  // ─── Listing Notifications ───────────────────────────────────────────────────

  async sendListingCreatedEmail(data: {
    sellerEmail: string;
    sellerName: string;
    listingTitle: string;
    listingId: string;
  }): Promise<void> {
    const bodyHtml = `
      <p style="margin-top:0;">Hi <strong>${this.escape(data.sellerName)}</strong>,</p>
      <p>Your listing <strong>${this.escape(data.listingTitle)}</strong> has been registered and is undergoing automated <strong>Trust Lens&trade;</strong> verification.</p>
      
      <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin:20px 0;">
        <p style="margin:0;font-size:13px;color:#475569;">
          <strong>Trust Lens&trade; Diagnostics in progress:</strong> We are running checks against GSMA blacklists, carrier block registries, and iCloud activation lock databases. Your listing will go live as soon as it passes.
        </p>
      </div>
    `;

    const html = this.buildEmailTemplate({
      title: 'Listing Submitted for Verification',
      previewText: `Your listing for ${data.listingTitle} is being verified.`,
      badgeText: 'Under Verification',
      badgeType: 'info',
      bodyHtml,
      cta: {
        label: 'View Verification Status',
        url: `${this.appUrl}/verification/${data.listingId}`,
      },
    });

    await this.send({
      to: data.sellerEmail,
      subject: 'Your listing has been submitted — VeriBuy',
      html,
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
    const statusConfig: Record<string, { label: string; badgeType: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; message: string }> = {
      ACTIVE: {
        label: 'Live & Active',
        badgeType: 'success',
        message: 'Great news! Your listing passed all Trust Lens™ hardware checks and is now live on the marketplace.',
      },
      REJECTED: {
        label: 'Listing Rejected',
        badgeType: 'danger',
        message: 'Your listing did not pass our automated security criteria or carrier registry audits.',
      },
      DELISTED: {
        label: 'Delisted',
        badgeType: 'warning',
        message: 'Your listing has been delisted and is temporarily hidden from buyers.',
      },
      SOLD: {
        label: 'Item Sold',
        badgeType: 'success',
        message: 'Congratulations! A buyer has purchased your listing with escrow protection.',
      },
      UNDER_REVIEW: {
        label: 'Manual Review',
        badgeType: 'info',
        message: 'Your listing requires manual review by our security team before going live.',
      },
      DRAFT: {
        label: 'Draft Saved',
        badgeType: 'neutral',
        message: 'Your listing is currently saved in draft state.',
      },
    };

    const cfg = statusConfig[data.status] || {
      label: data.status,
      badgeType: 'info' as const,
      message: `Your listing status has been updated to ${data.status}.`,
    };

    const bodyHtml = `
      <p style="margin-top:0;">Hi <strong>${this.escape(data.sellerName)}</strong>,</p>
      <p>${cfg.message}</p>
      
      <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin:24px 0;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size:14px;">
          <tr>
            <td style="color:#64748b;padding:6px 0;">Listing:</td>
            <td align="right" style="font-weight:700;color:#0f172a;">${this.escape(data.listingTitle)}</td>
          </tr>
          <tr>
            <td style="color:#64748b;padding:6px 0;">Status:</td>
            <td align="right" style="font-weight:700;color:#059669;">${this.escape(cfg.label)}</td>
          </tr>
          ${data.reason ? `
          <tr>
            <td style="color:#64748b;padding:6px 0;">Notes:</td>
            <td align="right" style="color:#e11d48;font-size:13px;">${this.escape(data.reason)}</td>
          </tr>
          ` : ''}
        </table>
      </div>
    `;

    const html = this.buildEmailTemplate({
      title: `Listing Update: ${cfg.label}`,
      previewText: `${data.listingTitle} status is now ${cfg.label}`,
      badgeText: cfg.label,
      badgeType: cfg.badgeType,
      bodyHtml,
      cta: {
        label: 'Manage Listing',
        url: `${this.appUrl}/listings/${data.listingId}`,
      },
    });

    await this.send({
      to: data.sellerEmail,
      subject: `Listing update: ${cfg.label} — VeriBuy`,
      html,
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
    const statusText = data.passed ? 'Diagnostics Passed' : 'Verification Failed';
    const badgeType = data.passed ? 'success' : 'danger';

    const bodyHtml = `
      <p style="margin-top:0;">Hi <strong>${this.escape(data.sellerName)}</strong>,</p>
      <p>The automated <strong>Trust Lens&trade;</strong> diagnostic audit for <strong>${this.escape(data.listingTitle)}</strong> has concluded.</p>
      
      <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:18px;margin:24px 0;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size:14px;">
          <tr>
            <td style="color:#64748b;padding:6px 0;">Diagnostic Result:</td>
            <td align="right" style="font-weight:800;color:${data.passed ? '#059669' : '#dc2626'};">${statusText}</td>
          </tr>
          ${data.conditionGrade ? `
          <tr>
            <td style="color:#64748b;padding:6px 0;">Condition Grade:</td>
            <td align="right" style="font-weight:700;color:#0f172a;">${this.escape(data.conditionGrade)}</td>
          </tr>
          ` : ''}
          ${data.notes ? `
          <tr>
            <td style="color:#64748b;padding:6px 0;">Audit Findings:</td>
            <td align="right" style="color:#475569;font-size:13px;">${this.escape(data.notes)}</td>
          </tr>
          ` : ''}
        </table>
      </div>

      ${data.passed ? `
      <div style="background-color:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:14px;font-size:13px;color:#065f46;">
        &#10004; A certified Trust Lens&trade; badge has been cryptographically attached to your listing. Buyers can view the verification report.
      </div>
      ` : `
      <div style="background-color:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px;font-size:13px;color:#991b1b;">
        &#9888; If you believe this device was flagged in error, please contact our support team with proof of purchase.
      </div>
      `}
    `;

    const html = this.buildEmailTemplate({
      title: `Trust Lens™: ${statusText}`,
      previewText: `Diagnostic results for ${data.listingTitle}: ${statusText}`,
      badgeText: statusText,
      badgeType,
      bodyHtml,
      cta: {
        label: 'View Diagnostic Certificate',
        url: `${this.appUrl}/verification/${data.listingId}`,
      },
    });

    await this.send({
      to: data.sellerEmail,
      subject: `Trust Lens result for your listing: ${statusText}`,
      html,
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

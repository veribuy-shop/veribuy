import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { PaginationDto, PaginatedResponse } from '@veribuy/common';

export interface InvoiceOrderData {
  id: string;
  buyerId: string;
  sellerId: string;
  listingId: string;
  listingTitle: string | null;
  listingDescription: string | null;
  listingCategory: string | null;
  amount: string | number;
  currency: string;
  status: string;
  shippingAddress: unknown;
  paidAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  completedAt: Date | null;
  disputedAt: Date | null;
  refundedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);
  private readonly resend: Resend;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly configService: ConfigService,
  ) {
    this.resend = new Resend(this.configService.getOrThrow<string>('RESEND_API_KEY'));
  }

  /**
   * Generate and persist an invoice for the given order at its current status.
   * Uploads the PDF to Cloudinary and emails it to the buyer.
   * Always call fire-and-forget — must not block order flow.
   */
  async generateAndSendInvoice(order: InvoiceOrderData, buyerEmail: string): Promise<void> {
    const invoiceNumber = `INV-${Date.now()}`;
    const shortId = order.id.substring(0, 8);

    try {
      // 1. Build the PDF buffer
      const pdfBuffer = await this.buildPdfBuffer(order, invoiceNumber);

      // 2. Upload to Cloudinary
      const pdfUrl = await this.cloudinary.uploadPdf(
        pdfBuffer,
        `invoices/${order.id}`,
        invoiceNumber,
      );

      // 3. Persist the invoice record
      const invoice = await this.prisma.invoice.create({
        data: {
          orderId: order.id,
          invoiceNumber,
          status: order.status as any,
          buyerId: order.buyerId,
          sellerId: order.sellerId,
          amount: order.amount as any,
          currency: order.currency,
          pdfUrl,
        },
      });

      // 4. Email the invoice to the buyer
      await this.resend.emails.send({
        from: 'VeriBuy <invoices@veribuy.com>',
        to: buyerEmail,
        subject: `Invoice ${invoiceNumber} — Order #${shortId} (${order.status})`,
        html: this.buildEmailHtml(order, invoiceNumber, pdfUrl),
      });

      // 5. Mark email as sent
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { emailSentAt: new Date() },
      });

      this.logger.log(
        `Invoice ${invoiceNumber} generated and sent to ${buyerEmail} for order ${order.id}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to generate invoice for order ${order.id}: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  /**
   * List all invoices for a given buyer, paginated.
   */
  async getInvoicesByBuyer(
    buyerId: string,
    pagination: PaginationDto,
  ): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { buyerId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.invoice.count({ where: { buyerId } }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * List all invoices for a given order.
   */
  async getInvoicesByOrder(orderId: string): Promise<any[]> {
    return this.prisma.invoice.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a single invoice by ID, with ownership check.
   */
  async getInvoice(invoiceId: string, requesterId: string, isAdmin: boolean): Promise<any> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    if (!isAdmin && invoice.buyerId !== requesterId && invoice.sellerId !== requesterId) {
      throw new NotFoundException(`Invoice ${invoiceId} not found`);
    }

    return invoice;
  }

  /**
   * Admin: list all invoices, paginated.
   */
  async getAllInvoices(pagination: PaginationDto): Promise<PaginatedResponse<any>> {
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.invoice.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.invoice.count(),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async buildPdfBuffer(order: InvoiceOrderData, invoiceNumber: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new (PDFDocument as any)({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const shortId = order.id.substring(0, 8);
      const amountFormatted = new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: order.currency,
      }).format(Number(order.amount));

      // ---- Header ----
      doc
        .fontSize(22)
        .font('Helvetica-Bold')
        .text('VeriBuy', 50, 50)
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#555555')
        .text('Verified Device Marketplace', 50, 76);

      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text('INVOICE', 400, 50, { align: 'right' })
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#555555')
        .text(`Invoice No: ${invoiceNumber}`, 400, 76, { align: 'right' })
        .text(`Date: ${new Date().toLocaleDateString('en-GB')}`, 400, 90, { align: 'right' });

      // ---- Divider ----
      doc.moveTo(50, 115).lineTo(545, 115).strokeColor('#dddddd').stroke();

      // ---- Order details ----
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text('Order Details', 50, 130);

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#333333')
        .text(`Order ID: #${shortId}`, 50, 148)
        .text(`Status: ${order.status.replace(/_/g, ' ')}`, 50, 163)
        .text(`Order Created: ${order.createdAt.toLocaleDateString('en-GB')}`, 50, 178);

      if (order.paidAt) {
        doc.text(`Paid At: ${order.paidAt.toLocaleDateString('en-GB')}`, 50, 193);
      }

      // ---- Line items header ----
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text('Item', 50, 225)
        .text('Amount', 400, 225, { align: 'right' });

      doc.moveTo(50, 240).lineTo(545, 240).strokeColor('#dddddd').stroke();

      const itemTitle = order.listingTitle ?? 'Device Listing';
      const itemCategory = order.listingCategory ?? '';
      const itemDescription = order.listingDescription
        ? order.listingDescription.substring(0, 120) +
          (order.listingDescription.length > 120 ? '\u2026' : '')
        : '';

      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text(itemTitle, 50, 250, { width: 300 });

      let itemY = 250 + (itemTitle.length > 50 ? 28 : 14);

      if (itemCategory) {
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('#555555')
          .text(`Category: ${itemCategory}`, 50, itemY);
        itemY += 13;
      }

      if (itemDescription) {
        doc
          .fontSize(9)
          .font('Helvetica')
          .fillColor('#555555')
          .text(itemDescription, 50, itemY, { width: 300 });
        itemY += 26;
      }

      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text(amountFormatted, 400, 250, { align: 'right' });

      doc.moveTo(50, itemY + 10).lineTo(545, itemY + 10).strokeColor('#dddddd').stroke();

      // ---- Total ----
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Total', 300, itemY + 20)
        .text(amountFormatted, 400, itemY + 20, { align: 'right' });

      // ---- Shipping address ----
      if (order.shippingAddress) {
        const addr = order.shippingAddress as Record<string, string>;
        const addrY = itemY + 55;

        doc
          .fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#000000')
          .text('Shipping Address', 50, addrY);

        let addrLineY = addrY + 15;
        if (addr.name) { doc.fontSize(10).font('Helvetica').fillColor('#333333').text(addr.name, 50, addrLineY); addrLineY += 14; }
        if (addr.line1) { doc.text(addr.line1, 50, addrLineY); addrLineY += 14; }
        if (addr.line2) { doc.text(addr.line2, 50, addrLineY); addrLineY += 14; }
        doc.text(`${addr.city ?? ''}, ${addr.state ?? ''} ${addr.postal_code ?? ''}`, 50, addrLineY);
        addrLineY += 14;
        if (addr.country) { doc.text(addr.country, 50, addrLineY); }
      }

      // ---- Footer ----
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#999999')
        .text(
          'VeriBuy \u2014 Verified Device Marketplace. This invoice was generated automatically.',
          50,
          760,
          { align: 'center', width: 495 },
        );

      doc.end();
    });
  }

  private buildEmailHtml(order: InvoiceOrderData, invoiceNumber: string, pdfUrl: string): string {
    const shortId = order.id.substring(0, 8);
    const amountFormatted = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: order.currency,
    }).format(Number(order.amount));

    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2 style="color: #1a1a1a;">Your VeriBuy Invoice</h2>
  <p>Hello,</p>
  <p>Please find your invoice <strong>${invoiceNumber}</strong> for Order <strong>#${shortId}</strong> (status: <strong>${order.status.replace(/_/g, ' ')}</strong>).</p>
  <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
    <tr>
      <td style="padding: 8px; border: 1px solid #eee; background: #f9f9f9;"><strong>Item</strong></td>
      <td style="padding: 8px; border: 1px solid #eee; background: #f9f9f9;">${order.listingTitle ?? 'Device Listing'}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #eee;"><strong>Amount</strong></td>
      <td style="padding: 8px; border: 1px solid #eee;">${amountFormatted}</td>
    </tr>
    <tr>
      <td style="padding: 8px; border: 1px solid #eee;"><strong>Invoice No.</strong></td>
      <td style="padding: 8px; border: 1px solid #eee;">${invoiceNumber}</td>
    </tr>
  </table>
  <p>
    <a href="${pdfUrl}" style="display:inline-block; padding: 10px 20px; background: #0070f3; color: #fff; text-decoration: none; border-radius: 4px;">
      Download Invoice PDF
    </a>
  </p>
  <p style="color: #999; font-size: 12px; margin-top: 32px;">
    This invoice was generated automatically by VeriBuy.
  </p>
</body>
</html>`;
  }
}

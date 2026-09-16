import { Injectable, Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import {
  DeviceWeightProfile,
  resolveDeviceWeightProfile,
  RoyalMailServiceTier,
  calculateRoyalMailRate,
  RoyalMailRateBreakdown,
  RoyalMailParcelFormat,
} from '@veribuy/common';

export interface DropoffLocation {
  id: string;
  name: string;
  type: 'POST_OFFICE' | 'DELIVERY_OFFICE' | 'PARCEL_POSTBOX' | 'DROP_BOX';
  addressLine1: string;
  town: string;
  postcode: string;
  distanceMiles: number;
  openingHours: {
    monday: string;
    tuesday: string;
    wednesday: string;
    thursday: string;
    friday: string;
    saturday: string;
    sunday: string;
  };
  features: string[];
}

export interface ShippingLabelOrderData {
  orderId: string;
  trackingNumber: string;
  service: string;
  parcelWeightGrams: number;
  parcelFormat: string;
  itemTitle: string;
  senderName: string;
  senderAddressLine1: string;
  senderTown: string;
  senderPostcode: string;
  recipientName: string;
  recipientAddressLine1: string;
  recipientAddressLine2?: string;
  recipientTown: string;
  recipientPostcode: string;
  recipientPhone?: string;
  createdAt: Date;
}

@Injectable()
export class RoyalMailService {
  private readonly logger = new Logger(RoyalMailService.name);

  /**
   * Generates a realistic Royal Mail tracking number based on the shipping service tier.
   */
  generateTrackingNumber(service: string = 'TRACKED_48'): string {
    const prefix =
      service === 'SPECIAL_DELIVERY_1PM'
        ? 'SD'
        : service === 'TRACKED_24'
          ? 'VQ'
          : 'TH';
    const randomDigits = Math.floor(100000000 + Math.random() * 900000000).toString();
    return `${prefix}${randomDigits}GB`;
  }

  /**
   * Resolves the device weight profile and calculated parcel format.
   */
  resolvePackageProfile(
    deviceType: string,
    brand?: string,
    model?: string,
    quantity: number = 1,
  ): DeviceWeightProfile {
    return resolveDeviceWeightProfile(deviceType, brand, model, quantity);
  }

  /**
   * Calculates shipping rate based on device profiling and destination postcode.
   */
  calculateShippingRate(
    deviceType: string,
    serviceTier: RoyalMailServiceTier = 'TRACKED_48',
    options?: {
      brand?: string;
      model?: string;
      quantity?: number;
      destinationPostcode?: string;
      itemValue?: number;
    },
  ): RoyalMailRateBreakdown {
    return calculateRoyalMailRate({
      deviceType,
      brand: options?.brand,
      model: options?.model,
      quantity: options?.quantity ?? 1,
      itemPrice: options?.itemValue,
      postcode: options?.destinationPostcode,
      service: serviceTier,
    });
  }

  /**
   * Generates a standard Royal Mail 4x6" PDF Shipping Label.
   */
  async generateShippingLabelPdf(data: ShippingLabelOrderData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      // 4x6 inches in points at 72dpi: 288 x 432 pt
      const doc = new PDFDocument({
        size: [288, 432],
        margins: { top: 12, bottom: 12, left: 14, right: 14 },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      const isTracked24 = data.service === 'TRACKED_24';
      const isSpecialDelivery = data.service === 'SPECIAL_DELIVERY_1PM';

      const serviceTitle = isSpecialDelivery
        ? 'SPECIAL DELIVERY GUARANTEED 1PM'
        : isTracked24
          ? 'ROYAL MAIL TRACKED 24'
          : 'ROYAL MAIL TRACKED 48';

      const serviceCode = isSpecialDelivery ? 'SD1' : isTracked24 ? 'T24' : 'T48';

      // ---- 1. Header & Service Banner ----
      doc.rect(14, 12, 260, 48).fill('#D81E05'); // Royal Mail Crucible Red

      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .fillColor('#FFFFFF')
        .text('Royal Mail', 22, 20);

      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .text(serviceTitle, 22, 38, { width: 170 });

      // Service Badge Box (e.g. "T24" / "T48" / "SD1")
      doc.rect(215, 16, 52, 40).fill('#FFFFFF');
      doc
        .fontSize(18)
        .font('Helvetica-Bold')
        .fillColor('#D81E05')
        .text(serviceCode, 215, 26, { width: 52, align: 'center' });

      // ---- 2. 2D DataMatrix Mock Box & Shipping Info ----
      doc.rect(14, 66, 260, 72).strokeColor('#222222').stroke();

      // Mock Data Matrix Pattern Box
      doc.rect(22, 74, 56, 56).fill('#111111');
      doc.rect(26, 78, 48, 48).fill('#FFFFFF');
      // Matrix dots pattern
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          if ((r + c) % 2 === 0) {
            doc.rect(30 + c * 10, 82 + r * 10, 7, 7).fill('#111111');
          }
        }
      }

      // Weight & Format Badges
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#111111')
        .text(`WEIGHT: ${data.parcelWeightGrams}g`, 90, 75);

      doc
        .fontSize(9)
        .font('Helvetica')
        .text(`FORMAT: ${data.parcelFormat.replace(/_/g, ' ')}`, 90, 90)
        .text(`ORDER REF: #${data.orderId.substring(0, 8).toUpperCase()}`, 90, 104)
        .text(`ITEM: ${data.itemTitle.substring(0, 24)}`, 90, 118, { width: 175 });

      // ---- 3. Barcode & Tracking Number ----
      doc.rect(14, 144, 260, 68).strokeColor('#222222').stroke();

      // Draw stylized 1D barcode lines
      const barcodeStartX = 28;
      const barcodeStartY = 152;
      const barcodeHeight = 36;
      const pattern = [2, 1, 3, 1, 2, 4, 1, 2, 3, 2, 1, 4, 2, 1, 3, 1, 2, 3, 1, 4, 2, 1, 3, 2, 1, 4, 2, 1, 3, 1, 2, 4, 1, 2, 3];
      let curX = barcodeStartX;
      for (const w of pattern) {
        doc.rect(curX, barcodeStartY, w, barcodeHeight).fill('#000000');
        curX += w + 2;
      }

      // Human-readable formatted tracking number
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text(data.trackingNumber, 14, 194, { width: 260, align: 'center' });

      // ---- 4. Deliver To Box ----
      doc.rect(14, 218, 260, 120).strokeColor('#222222').stroke();

      doc
        .fontSize(8)
        .font('Helvetica-Bold')
        .fillColor('#777777')
        .text('DELIVER TO:', 22, 226);

      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#000000')
        .text(data.recipientName, 22, 238)
        .fontSize(10)
        .font('Helvetica')
        .text(data.recipientAddressLine1, 22, 254);

      if (data.recipientAddressLine2) {
        doc.text(data.recipientAddressLine2, 22, 268);
        doc.text(data.recipientTown, 22, 282);
        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .text(data.recipientPostcode.toUpperCase(), 22, 298);
      } else {
        doc.text(data.recipientTown, 22, 268);
        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .text(data.recipientPostcode.toUpperCase(), 22, 284);
      }

      // ---- 5. Return Address & Drop-off Instructions ----
      doc.rect(14, 344, 260, 76).fill('#F8F9FA').strokeColor('#CCCCCC').stroke();

      doc
        .fontSize(7)
        .font('Helvetica-Bold')
        .fillColor('#555555')
        .text('RETURN ADDRESS / SENDER:', 20, 350);

      doc
        .fontSize(7)
        .font('Helvetica')
        .fillColor('#333333')
        .text(
          `${data.senderName}, ${data.senderAddressLine1}, ${data.senderTown} ${data.senderPostcode}`,
          20,
          360,
          { width: 248 },
        );

      doc
        .fontSize(7)
        .font('Helvetica-Bold')
        .fillColor('#D81E05')
        .text('POST OFFICE / CUSTOMER SERVICE POINT DROP-OFF', 20, 376);

      doc
        .fontSize(6.5)
        .font('Helvetica')
        .fillColor('#666666')
        .text(
          'Drop off at any Post Office branch or Royal Mail Delivery Office. Scan barcode on receipt for instant Proof of Postage.',
          20,
          388,
          { width: 248 },
        );

      doc.end();
    });
  }

  /**
   * Generates a Data URL for the Post Office counter Drop-off QR code.
   */
  generateDropoffQrCode(orderId: string, trackingNumber: string): string {
    const payload = JSON.stringify({
      provider: 'ROYAL_MAIL',
      orderId,
      trackingNumber,
      timestamp: new Date().toISOString(),
      action: 'DROP_OFF_SCAN',
    });
    // Base64 encoded payload URI for Post Office terminal emulation
    const base64Data = Buffer.from(payload).toString('base64');
    return `data:application/json;base64,${base64Data}`;
  }

  /**
   * Finds nearby Royal Mail drop-off points (Post Offices, Delivery Offices, Parcel Postboxes).
   */
  findDropoffLocations(postcode: string, _radiusMiles: number = 5): DropoffLocation[] {
    const cleanPostcode = postcode ? postcode.toUpperCase().trim() : 'SW1A 1AA';
    const outward = cleanPostcode.split(' ')[0] || 'SW1A';

    return [
      {
        id: `PO-${outward}-01`,
        name: `${outward} Main Post Office`,
        type: 'POST_OFFICE',
        addressLine1: '12 High Street',
        town: 'London',
        postcode: `${outward} 1AA`,
        distanceMiles: 0.3,
        openingHours: {
          monday: '08:30 - 18:00',
          tuesday: '08:30 - 18:00',
          wednesday: '08:30 - 18:00',
          thursday: '08:30 - 18:00',
          friday: '08:30 - 18:00',
          saturday: '09:00 - 16:00',
          sunday: 'Closed',
        },
        features: [
          'Counter Drop-off',
          'Free QR Code Label Printing',
          'Instant Proof of Postage',
          'Wheelchair Accessible',
        ],
      },
      {
        id: `DO-${outward}-02`,
        name: `Royal Mail ${outward} Delivery Office (CSP)`,
        type: 'DELIVERY_OFFICE',
        addressLine1: '45 Station Road',
        town: 'London',
        postcode: `${outward} 4BB`,
        distanceMiles: 0.8,
        openingHours: {
          monday: '07:00 - 13:00',
          tuesday: '07:00 - 13:00',
          wednesday: '07:00 - 13:00',
          thursday: '07:00 - 13:00',
          friday: '07:00 - 13:00',
          saturday: '07:00 - 14:00',
          sunday: '10:00 - 14:00',
        },
        features: [
          'Early Morning Drop-off',
          'Parcel Post Box with QR Scanner',
          'Instant Proof of Postage',
          'Free Parking',
        ],
      },
      {
        id: `PO-${outward}-03`,
        name: `Local Post Office at Spar`,
        type: 'POST_OFFICE',
        addressLine1: '88 Commercial Way',
        town: 'London',
        postcode: `${outward} 7DD`,
        distanceMiles: 1.2,
        openingHours: {
          monday: '07:00 - 22:00',
          tuesday: '07:00 - 22:00',
          wednesday: '07:00 - 22:00',
          thursday: '07:00 - 22:00',
          friday: '07:00 - 22:00',
          saturday: '07:00 - 22:00',
          sunday: '08:00 - 21:00',
        },
        features: [
          'Late Evening Drop-off',
          'Open 7 Days a Week',
          'Pre-printed Label Scan Only',
        ],
      },
      {
        id: `PB-${outward}-04`,
        name: `Royal Mail Parcel Postbox`,
        type: 'PARCEL_POSTBOX',
        addressLine1: 'Corner of Queen Road & Park Ave',
        town: 'London',
        postcode: `${outward} 9ZZ`,
        distanceMiles: 0.5,
        openingHours: {
          monday: '24 Hours',
          tuesday: '24 Hours',
          wednesday: '24 Hours',
          thursday: '24 Hours',
          friday: '24 Hours',
          saturday: '24 Hours',
          sunday: '24 Hours',
        },
        features: [
          '24/7 Access',
          'Pre-applied Label Drop-box',
          'App Barcode Scanner',
        ],
      },
    ];
  }
}

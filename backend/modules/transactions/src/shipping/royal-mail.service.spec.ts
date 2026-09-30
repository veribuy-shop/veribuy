import { Test, TestingModule } from '@nestjs/testing';
import { RoyalMailService, ShippingLabelOrderData } from './royal-mail.service';

describe('RoyalMailService', () => {
  let service: RoyalMailService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RoyalMailService],
    }).compile();

    service = module.get<RoyalMailService>(RoyalMailService);
  });

  afterEach(() => {
    delete process.env.ROYAL_MAIL_CLICK_DROP_KEY;
    delete process.env.ROYAL_MAIL_API_URL;
    jest.restoreAllMocks();
  });

  const mockOrderData: ShippingLabelOrderData = {
    orderId: 'ord-test-12345678',
    trackingNumber: 'TH123456789GB',
    service: 'TRACKED_48',
    parcelWeightGrams: 350,
    parcelFormat: 'SMALL_PARCEL',
    itemTitle: 'iPhone 13 Pro 128GB',
    senderName: 'VeriBuy Verified Seller',
    senderAddressLine1: '10 Logistics Way',
    senderTown: 'London',
    senderPostcode: 'EC1A 1BB',
    recipientName: 'Alice Buyer',
    recipientAddressLine1: '123 High Street',
    recipientTown: 'Manchester',
    recipientPostcode: 'M1 1AA',
    recipientPhone: '+447700900000',
    createdAt: new Date('2026-09-30T10:00:00Z'),
  };

  it('should generate valid Royal Mail tracking numbers with appropriate prefixes', () => {
    const t48 = service.generateTrackingNumber('TRACKED_48');
    expect(t48).toMatch(/^TH\d{9}GB$/);

    const t24 = service.generateTrackingNumber('TRACKED_24');
    expect(t24).toMatch(/^VQ\d{9}GB$/);

    const sd = service.generateTrackingNumber('SPECIAL_DELIVERY_1PM');
    expect(sd).toMatch(/^SD\d{9}GB$/);
  });

  it('should resolve package profiles correctly for hardware categories', () => {
    const profile = service.resolvePackageProfile('SMARTPHONE', 'Apple', 'iPhone 13 Pro', 1);
    expect(profile.parcelFormat).toBe('SMALL_PARCEL');
    expect(profile.totalWeightGrams).toBeGreaterThan(0);
  });

  it('should calculate tiered shipping rates with buffer', () => {
    const rate = service.calculateShippingRate('SMARTPHONE', 'TRACKED_48', {
      brand: 'Apple',
      model: 'iPhone 13 Pro',
      itemValue: 450,
      destinationPostcode: 'SW1A 1AA',
    });
    expect(rate.totalFee).toBeGreaterThan(0);
    expect(rate.service).toBe('TRACKED_48');
  });

  it('should generate a local 4x6" PDF shipping label buffer', async () => {
    const pdfBuffer = await service.generateShippingLabelPdf(mockOrderData);
    expect(pdfBuffer).toBeInstanceOf(Buffer);
    expect(pdfBuffer.length).toBeGreaterThan(100);
    // PDF magic bytes %PDF-
    expect(pdfBuffer.toString('utf-8', 0, 5)).toBe('%PDF-');
  });

  it('should generate drop-off QR codes and drop-off locations', () => {
    const qrDataUrl = service.generateDropoffQrCode('ord-123', 'TH123456789GB');
    expect(qrDataUrl).toContain('data:application/json;base64,');

    const locations = service.findDropoffLocations('SW1A 1AA', 5);
    expect(locations.length).toBeGreaterThan(0);
    expect(locations[0].postcode).toContain('SW1A');
  });

  describe('Click & Drop API Integration', () => {
    it('should return error when ROYAL_MAIL_CLICK_DROP_KEY is not configured', async () => {
      delete process.env.ROYAL_MAIL_CLICK_DROP_KEY;
      const result = await service.createClickDropOrder(mockOrderData);
      expect(result.success).toBe(false);
      expect(result.error).toContain('ROYAL_MAIL_CLICK_DROP_KEY not configured');
    });

    it('should call Click & Drop API when key is configured', async () => {
      process.env.ROYAL_MAIL_CLICK_DROP_KEY = 'mock-key-123';
      process.env.ROYAL_MAIL_API_URL = 'https://api.parcel.royalmail.com/api/v1';

      const mockApiResponse = {
        successCount: 1,
        errorsCount: 0,
        createdOrders: [
          {
            orderIdentifier: 998877,
            orderReference: 'VB-ord-test-12345678',
            trackingNumber: 'TH998877665GB',
            label: Buffer.from('%PDF-1.4 Mock Label').toString('base64'),
          },
        ],
        failedOrders: [],
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockApiResponse,
      } as any);

      const result = await service.createClickDropOrder(mockOrderData, {
        itemPrice: 250,
        shippingCost: 4.5,
      });

      expect(result.success).toBe(true);
      expect(result.orderIdentifier).toBe(998877);
      expect(result.trackingNumber).toBe('TH998877665GB');
      expect(result.labelPdfBuffer).toBeInstanceOf(Buffer);
      expect(result.labelPdfBuffer?.toString('utf-8')).toContain('%PDF-1.4');
    });

    it('should fetch label PDF from Click & Drop API', async () => {
      process.env.ROYAL_MAIL_CLICK_DROP_KEY = 'mock-key-123';
      const mockPdfData = Buffer.from('%PDF-MockBinaryContent');

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: async () => mockPdfData.buffer,
      } as any);

      const buffer = await service.fetchClickDropLabelPdf(998877);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer?.toString('utf-8')).toContain('%PDF-');
    });

    it('should update Click & Drop order status', async () => {
      process.env.ROYAL_MAIL_CLICK_DROP_KEY = 'mock-key-123';

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      } as any);

      const updated = await service.updateClickDropOrderStatus(998877, 'despatched', 'TH998877665GB');
      expect(updated).toBe(true);
    });
  });
});

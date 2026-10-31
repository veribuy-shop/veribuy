import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ImeiCheckService } from './imei-check.service';

describe('ImeiCheckService', () => {
  let service: ImeiCheckService;
  let originalFetch: typeof global.fetch;

  beforeEach(async () => {
    originalFetch = global.fetch;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImeiCheckService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: any) => {
              if (key === 'IMEI_CHECK_API_KEY') return 'test-key';
              if (key === 'IMEI_CHECK_API_URL') return 'https://test.imeicheck.com';
              return def;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ImeiCheckService>(ImeiCheckService);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('checkImei', () => {
    it('should return CLEAN and imeiValid = true when checks succeed with no issues', async () => {
      global.fetch = jest.fn().mockImplementation((url: string) => {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              orderId: 101,
              status: 'success',
              imei: '356938035643803',
              price: '0.05',
              object: {
                blacklistStatus: 'CLEAN',
                model: 'iPhone 14 Pro',
              },
            }),
        });
      });

      const result = await service.checkImei('356938035643803', 'Apple');

      expect(result.imeiValid).toBe(true);
      expect(result.flags).toEqual(['CLEAN']);
      expect(result.blacklisted).toBe(false);
      expect(result.reportedStolen).toBe(false);
    });

    it('should detect explicitly invalid IMEI and flag IMEI_MISMATCH with imeiValid = false', async () => {
      global.fetch = jest.fn().mockImplementation((url: string) => {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              orderId: 102,
              status: 'failed',
              imei: '000000000000000',
              price: '0.00',
              response: 'IMEI Invalid or Not Found in database',
            }),
        });
      });

      const result = await service.checkImei('000000000000000', 'Apple');

      expect(result.imeiValid).toBe(false);
      expect(result.flags).toContain('IMEI_MISMATCH');
    });

    it('should return NOT_RUN and imeiValid = false when all upstream services fail to run', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network timeout / upstream down'));

      const result = await service.checkImei('356938035643803', 'Samsung');

      expect(result.imeiValid).toBe(false);
      expect(result.flags).toEqual(['NOT_RUN']);
    });

    it('should flag BLACKLISTED and imeiValid = false when blacklist service indicates blacklisted device', async () => {
      global.fetch = jest.fn().mockImplementation((url: string) => {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              orderId: 103,
              status: 'success',
              imei: '356938035643803',
              price: '0.05',
              object: {
                blacklisted: true,
              },
              result: 'Blacklist Status: Blacklisted',
            }),
        });
      });

      const result = await service.checkImei('356938035643803', 'Apple');

      expect(result.imeiValid).toBe(false);
      expect(result.flags).toContain('BLACKLISTED');
    });

  describe('real provider payloads (regression)', () => {
    // Exact shape returned by the live provider for a blacklisted Nokia IMEI
    // listed as an Apple device — previously parsed as CLEAN and auto-approved.
    const service3Response = {
      imei: '356938035643809',
      object: false,
      result: 'Only Apple devices supported. This device is a NA.',
      status: 'failed',
      orderId: 114070486,
    };
    const service5Response = {
      imei: '356938035643809',
      object: { name: 'N900', brand: 'Nokia', model: 'N900', blacklistStatus: true, gsmaBlacklisted: true },
      result:
        "IMEI: 356938035643809<br>Brand: Nokia<br>Model: N900<br>Model Name: N900<br>Blacklist Status: <span style='color:red;'>Blacklisted</span><br><br><b><font color=\"#d97706\">Fraud Risk Score: 90/100</font></b><br>This device shows elevated activity that may indicate fraud, cloning, or suspicious resale activity.<br>",
      status: 'success',
      orderId: 114070487,
    };

    const mockProvider = (s3: unknown, s5: unknown) => {
      global.fetch = jest.fn().mockImplementation((url: string) =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(url.includes('service=3') ? s3 : s5),
        }),
      ) as any;
    };

    it('flags a blacklisted, brand-mismatched, high-fraud device and never marks it CLEAN', async () => {
      mockProvider(service3Response, service5Response);

      const result = await service.checkImei('356938035643809', 'Apple');

      expect(result.blacklisted).toBe(true);
      expect(result.imeiValid).toBe(false);
      expect(result.reportedBrand).toBe('Nokia');
      expect(result.fraudRiskScore).toBe(90);
      expect(result.flags).toEqual(expect.arrayContaining(['BLACKLISTED', 'IMEI_MISMATCH', 'HIGH_FRAUD_RISK']));
      expect(result.flags).not.toContain('CLEAN');
    });

    it('detects "Blacklisted" from the HTML result text alone', async () => {
      mockProvider(service3Response, { ...service5Response, object: { brand: 'Nokia' } });

      const result = await service.checkImei('356938035643809', 'Nokia');

      expect(result.blacklisted).toBe(true);
      expect(result.flags).toContain('BLACKLISTED');
      expect(result.flags).not.toContain('IMEI_MISMATCH');
    });

    it('still treats an HTML "Blacklist Status: Clean" result as clean', async () => {
      mockProvider(service3Response, {
        ...service5Response,
        object: { brand: 'Nokia', blacklistStatus: false },
        result: 'IMEI: 1<br>Brand: Nokia<br>Blacklist Status: <span style=\'color:green;\'>Clean</span><br><b>Fraud Risk Score: 5/100</b><br>',
      });

      const result = await service.checkImei('356938035643809', 'Nokia');

      expect(result.blacklisted).toBe(false);
      expect(result.flags).toEqual(['CLEAN']);
    });
  });
  });
});

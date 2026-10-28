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
  });
});

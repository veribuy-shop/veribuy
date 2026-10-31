import { JwtService } from '@nestjs/jwt';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { SocialTokenVerifierService } from './social-token-verifier.service';

describe('SocialTokenVerifierService', () => {
  const CLIENT_ID = 'web-client.apps.googleusercontent.com';
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'key-1', kty: 'RSA', alg: 'RS256', use: 'sig' };
  const jwtService = new JwtService({});
  let config: { get: jest.Mock };
  let service: SocialTokenVerifierService;
  const realFetch = global.fetch;

  const sign = (claims: Record<string, unknown>, kid = 'key-1', key: crypto.KeyObject = privateKey) =>
    jwtService.sign(
      { sub: 'google-sub-1', email: 'jane@example.com', email_verified: true, ...claims },
      {
        privateKey: key.export({ type: 'pkcs8', format: 'pem' }).toString(),
        algorithm: 'RS256',
        keyid: kid,
        issuer: 'https://accounts.google.com',
        audience: CLIENT_ID,
        expiresIn: '5m',
      },
    );

  beforeEach(() => {
    config = { get: jest.fn((key: string) => (key === 'GOOGLE_CLIENT_IDS' ? CLIENT_ID : undefined)) };
    service = new SocialTokenVerifierService(jwtService, config as any);
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ keys: [jwk] }) }) as any;
  });

  afterAll(() => {
    global.fetch = realFetch;
  });

  it('returns the verified identity for a valid Google ID token', async () => {
    await expect(service.verify('GOOGLE', sign({}))).resolves.toMatchObject({
      email: 'jane@example.com',
      subject: 'google-sub-1',
    });
  });

  it('rejects a token signed by a different key', async () => {
    const { privateKey: attackerKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    await expect(service.verify('GOOGLE', sign({}, 'key-1', attackerKey))).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token issued for another app (audience mismatch)', async () => {
    config.get.mockImplementation((key: string) => (key === 'GOOGLE_CLIENT_IDS' ? 'other-app' : undefined));
    await expect(service.verify('GOOGLE', sign({}))).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an unverified email claim', async () => {
    await expect(service.verify('GOOGLE', sign({ email_verified: false }))).rejects.toThrow(UnauthorizedException);
  });

  it('rejects unsigned / HS256 tokens', async () => {
    const hs = jwtService.sign({ email: 'jane@example.com' }, { secret: 'x', header: { kid: 'key-1', alg: 'HS256' } as any });
    await expect(service.verify('GOOGLE', hs)).rejects.toThrow(UnauthorizedException);
  });

  it('is disabled when no client IDs are configured', async () => {
    config.get.mockReturnValue(undefined);
    await expect(service.verify('GOOGLE', sign({}))).rejects.toThrow(ServiceUnavailableException);
  });
});

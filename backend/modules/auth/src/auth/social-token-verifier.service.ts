import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export type SocialProvider = 'GOOGLE' | 'APPLE';

export interface VerifiedSocialIdentity {
  provider: SocialProvider;
  subject: string;
  email: string;
  name?: string;
}

interface ProviderConfig {
  jwksUrl: string;
  issuers: string[];
  audienceEnv: string;
}

const PROVIDERS: Record<SocialProvider, ProviderConfig> = {
  GOOGLE: {
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    issuers: ['https://accounts.google.com', 'accounts.google.com'],
    audienceEnv: 'GOOGLE_CLIENT_IDS',
  },
  APPLE: {
    jwksUrl: 'https://appleid.apple.com/auth/keys',
    issuers: ['https://appleid.apple.com'],
    audienceEnv: 'APPLE_CLIENT_IDS',
  },
};

const JWKS_CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * Verifies Google / Apple ID tokens server-side.
 *
 * SECURITY: the identity (email) used for social sign-in is taken exclusively
 * from a provider-signed ID token whose signature, issuer, audience and expiry
 * have been verified. Client-supplied emails are never trusted.
 */
@Injectable()
export class SocialTokenVerifierService {
  private readonly logger = new Logger(SocialTokenVerifierService.name);
  private readonly jwksCache = new Map<string, { keys: Map<string, string>; fetchedAt: number }>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async verify(provider: SocialProvider, idToken: string): Promise<VerifiedSocialIdentity> {
    const config = PROVIDERS[provider];
    const audiences = (this.configService.get<string>(config.audienceEnv) || '')
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);

    if (audiences.length === 0) {
      throw new ServiceUnavailableException(`${provider} sign-in is not configured`);
    }

    const decoded = this.jwtService.decode(idToken, { complete: true }) as
      | { header?: { kid?: string; alg?: string } }
      | null;
    const kid = decoded?.header?.kid;
    if (!kid || decoded?.header?.alg !== 'RS256') {
      throw new UnauthorizedException('Invalid identity token');
    }

    const publicKey = await this.getSigningKey(config.jwksUrl, kid);
    if (!publicKey) {
      throw new UnauthorizedException('Invalid identity token');
    }

    let payload: Record<string, any>;
    try {
      payload = await this.jwtService.verifyAsync(idToken, {
        publicKey,
        algorithms: ['RS256'],
        audience: audiences as [string, ...string[]],
        issuer: config.issuers as [string, ...string[]],
      });
    } catch (err: any) {
      this.logger.warn(`${provider} identity token rejected: ${err?.message}`);
      throw new UnauthorizedException('Invalid identity token');
    }

    const email = typeof payload.email === 'string' ? payload.email.toLowerCase().trim() : '';
    // Google sends a boolean, Apple sends a string.
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
    if (!email || !emailVerified || typeof payload.sub !== 'string') {
      throw new UnauthorizedException('Identity provider did not return a verified email');
    }

    return {
      provider,
      subject: payload.sub,
      email,
      name: typeof payload.name === 'string' ? payload.name : undefined,
    };
  }

  private async getSigningKey(jwksUrl: string, kid: string): Promise<string | null> {
    let cached = this.jwksCache.get(jwksUrl);
    const stale = !cached || Date.now() - cached.fetchedAt > JWKS_CACHE_TTL_MS;

    // Refetch on expiry or when an unknown kid appears (provider key rotation).
    if (!cached || stale || !cached.keys.has(kid)) {
      cached = await this.fetchJwks(jwksUrl);
      this.jwksCache.set(jwksUrl, cached);
    }

    return cached.keys.get(kid) ?? null;
  }

  private async fetchJwks(jwksUrl: string): Promise<{ keys: Map<string, string>; fetchedAt: number }> {
    let body: { keys?: Array<Record<string, any>> };
    try {
      const res = await fetch(jwksUrl, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      body = await res.json();
    } catch (err: any) {
      this.logger.error(`Failed to fetch JWKS from ${jwksUrl}: ${err?.message}`);
      throw new ServiceUnavailableException('Identity provider unavailable');
    }

    const keys = new Map<string, string>();
    for (const jwk of body.keys ?? []) {
      if (!jwk.kid || jwk.kty !== 'RSA') continue;
      const pem = crypto
        .createPublicKey({ key: jwk as crypto.JsonWebKey, format: 'jwk' })
        .export({ type: 'spki', format: 'pem' })
        .toString();
      keys.set(jwk.kid, pem);
    }
    return { keys, fetchedAt: Date.now() };
  }
}

import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '@veribuy/redis-cache';
import { PrismaService } from '../../../../../src/database/prisma.service';
import { sessionRevokedBeforeKey, userAuthStateKey } from '../auth.service';

interface UserAuthState {
  role: string;
  isActive: boolean;
  isEmailVerified: boolean;
}

/** Short cache so role changes / disables apply within seconds without a DB hit per request. */
const USER_STATE_CACHE_SECONDS = 30;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      algorithms: ['HS256'],
    });
  }

  /**
   * SECURITY: the token only proves identity. Role, active status and session
   * revocation are resolved from server-side state so a disabled user, a demoted
   * admin, or a session revoked by a password change cannot keep acting until
   * the access token expires.
   */
  async validate(payload: { sub: string; role: string; iat?: number }) {
    const revokedBefore = await this.redis
      .get<number>(sessionRevokedBeforeKey(payload.sub))
      .catch(() => null);
    if (revokedBefore && (payload.iat ?? 0) * 1000 < Number(revokedBefore)) {
      throw new UnauthorizedException('Session has been revoked');
    }

    const state = await this.loadUserState(payload.sub);
    if (!state || !state.isActive) {
      throw new UnauthorizedException('Account not found or disabled');
    }

    return {
      userId: payload.sub,
      role: state.role,
      isEmailVerified: state.isEmailVerified,
    };
  }

  private async loadUserState(userId: string): Promise<UserAuthState | null> {
    const cacheKey = userAuthStateKey(userId);
    const cached = await this.redis.get<UserAuthState>(cacheKey).catch(() => null);
    if (cached && typeof cached === 'object') return cached;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true, isEmailVerified: true },
    });
    if (!user) return null;

    const state: UserAuthState = {
      role: user.role,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
    };
    await this.redis.set(cacheKey, state, USER_STATE_CACHE_SECONDS).catch((err: any) => {
      this.logger.warn(`Failed to cache auth state for ${userId}: ${err?.message}`);
    });
    return state;
  }
}

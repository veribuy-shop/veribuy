import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '@veribuy/redis-cache';

@Controller()
export class RootController {
  @Get()
  root() {
    return {
      service: 'veribuy-backend',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check() {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const databaseUp = database.status !== 'down';

    return {
      status: databaseUp ? 'ok' : 'error',
      service: 'veribuy-backend',
      timestamp: new Date().toISOString(),
      modules: {
        auth: { name: 'Auth & Identity API', status: 'up', route: '/auth' },
        users: { name: 'Users & Profiles API', status: 'up', route: '/users' },
        listings: { name: 'Listings & Catalog API', status: 'up', route: '/listings' },
        trustLens: { name: 'Trust Lens™ Verification API', status: 'up', route: '/trust-lens' },
        transactions: { name: 'Transactions & Escrow API', status: 'up', route: '/transactions' },
        evidence: { name: 'Evidence Vault API', status: 'up', route: '/evidence' },
        notifications: { name: 'Notifications & Messaging API', status: 'up', route: '/messages' },
      },
      details: {
        database,
        redis,
      },
    };
  }

  private async checkDatabase() {
    const startedAt = Date.now();
    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('health check timed out')), 3000),
      );
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1 as ok`,
        timeout,
      ]);
      return { status: 'up', responseTime: Date.now() - startedAt };
    } catch {
      return { status: 'down', responseTime: Date.now() - startedAt };
    }
  }

  private async checkRedis() {
    const startedAt = Date.now();
    try {
      const client = this.redis.getClient();
      if (!client) {
        return {
          status: 'disabled',
          note: process.env.REDIS_DISABLED === 'true' ? 'REDIS_DISABLED=true' : 'client unavailable',
          responseTime: Date.now() - startedAt,
        };
      }
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('health check timed out')), 3000),
      );
      await Promise.race([client.ping(), timeout]);
      return { status: 'up', responseTime: Date.now() - startedAt };
    } catch {
      return { status: 'down', responseTime: Date.now() - startedAt };
    }
  }
}

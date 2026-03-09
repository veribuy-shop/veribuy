import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;

  async onModuleInit() {
    // REDIS_TLS=true enables TLS (required in production on Railway — port 6380).
    // Local dev leaves this unset so plain Redis on 6379 continues to work.
    const tlsEnabled = process.env.REDIS_TLS === 'true';

    // Prefer REDIS_URL (Railway injects this automatically) over individual vars.
    const redisUrl = process.env.REDIS_URL;

    // When REDIS_TLS is set and the URL uses plain redis://, promote it to rediss://
    // so ioredis activates TLS on the same URL path.
    const effectiveUrl = redisUrl
      ? tlsEnabled && redisUrl.startsWith('redis://')
        ? redisUrl.replace(/^redis:\/\//, 'rediss://')
        : redisUrl
      : undefined;

    this.client = effectiveUrl
      ? new Redis(effectiveUrl, {
          tls: tlsEnabled ? {} : undefined,
          retryStrategy: (times: number) => Math.min(times * 50, 2000),
        })
      : new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || (tlsEnabled ? '6380' : '6379')),
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB || '0'),
          tls: tlsEnabled ? {} : undefined,
          retryStrategy: (times: number) => Math.min(times * 50, 2000),
        });

    this.client.on('error', (err: Error) => {
      console.error('Redis Client Error:', err);
    });

    this.client.on('connect', () => {
      console.log('Redis Client Connected');
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    if (ttl) {
      await this.client.setex(key, ttl, stringValue);
    } else {
      await this.client.set(key, stringValue);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async delPattern(pattern: string): Promise<void> {
    const keys = await this.client.keys(pattern);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async ttl(key: string): Promise<number> {
    return await this.client.ttl(key);
  }

  async incr(key: string): Promise<number> {
    return await this.client.incr(key);
  }

  async decr(key: string): Promise<number> {
    return await this.client.decr(key);
  }

  getClient(): Redis {
    return this.client;
  }
}

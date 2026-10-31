import { Logger } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { RedisService } from '@veribuy/redis-cache';

// Fixed-window counter + block marker, evaluated atomically in Redis.
const INCREMENT_SCRIPT = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('PTTL', KEYS[1])
local blocked = redis.call('PTTL', KEYS[2])
if blocked <= 0 and hits > tonumber(ARGV[2]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
  blocked = tonumber(ARGV[3])
end
return {hits, ttl, blocked}
`;

/**
 * Rate-limit counters shared across all backend instances via Redis, so limits
 * hold after scaling out or restarting. Falls back to in-memory counting if
 * Redis is unavailable (fail open on availability, never on correctness of keys).
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly fallback = new ThrottlerStorageService();

  constructor(private readonly redis: RedisService) {}

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string) {
    const client = this.redis.getClient();
    if (client && client.status === 'ready') {
      try {
        const hitsKey = `throttle:${throttlerName}:${key}`;
        const [hits, ttlMs, blockedMs] = (await client.eval(
          INCREMENT_SCRIPT,
          2,
          hitsKey,
          `${hitsKey}:blocked`,
          ttl,
          limit,
          blockDuration || ttl,
        )) as [number, number, number];
        const isBlocked = blockedMs > 0;
        return {
          totalHits: hits,
          timeToExpire: Math.max(0, Math.ceil(ttlMs / 1000)),
          isBlocked,
          timeToBlockExpire: isBlocked ? Math.ceil(blockedMs / 1000) : 0,
        };
      } catch (err: any) {
        this.logger.warn(`Redis throttling failed, using in-memory fallback: ${err?.message}`);
      }
    }
    return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
  }
}

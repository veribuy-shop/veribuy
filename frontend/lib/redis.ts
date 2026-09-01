import Redis from 'ioredis';

/**
 * Shared Redis key prefix for the IMEI check status cache — must match the
 * backend ImeiCheckWorker (see backend/modules/trust-lens/src/imei-check/imei-check.worker.ts)
 * so the frontend BFF can surface live in-progress check outcomes directly.
 */
const STATUS_PREFIX = 'veribuy:verification-status:listing:';

let client: Redis | null = null;

/**
 * Lazily create a shared ioredis client for the frontend BFF.
 *
 * Mirrors the backend's RedisService config so a single Redis instance can be
 * shared across services: prefers REDIS_URL (injected by Render), promotes
 * redis:// → rediss:// when REDIS_TLS is set, and otherwise falls back to the
 * standard host/port/password variables.
 *
 * Returns null when Redis is disabled/unconfigured so callers fail open.
 */
function getClient(): Redis | null {
  if (process.env.REDIS_DISABLED === 'true') return null;
  if (client) return client;

  const tlsEnabled = process.env.REDIS_TLS === 'true';
  const redisUrl = process.env.REDIS_URL;
  const effectiveUrl = redisUrl
    ? tlsEnabled && redisUrl.startsWith('redis://')
      ? redisUrl.replace(/^redis:\/\//, 'rediss://')
      : redisUrl
    : undefined;

  client = effectiveUrl
    ? new Redis(effectiveUrl, {
        tls: tlsEnabled ? {} : undefined,
        retryStrategy: (times: number) => Math.min(times * 50, 2000),
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      })
    : new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || (tlsEnabled ? '6380' : '6379')),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
        tls: tlsEnabled ? {} : undefined,
        retryStrategy: (times: number) => Math.min(times * 50, 2000),
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });

  // Do not let an idle client keep a serverless/edge process alive — unref the
  // underlying socket so the event loop can exit if nothing else is pending.
  (client.stream as unknown as { unref?: () => void } | undefined)?.unref?.();

  client.on('error', (err) => {
    // Never crash the BFF — Redis is best-effort. Disable further attempts and
    // fall back to proxying the backend as before.
    console.error('Frontend Redis Client Error:', err.message);
  });

  return client;
}

/**
 * Read the cached IMEI check outcome for a listing, if any. Returns null when
 * there is nothing cached or Redis is unavailable (fail-open). The status value
 * is the raw object written by the backend worker.
 */
export async function getCachedImeiStatus(
  listingId: string,
): Promise<Record<string, unknown> | null> {
  const c = getClient();
  if (!c) return null;
  try {
    const value = await c.get(`${STATUS_PREFIX}${listingId}`);
    if (!value) return null;
    return JSON.parse(value) as Record<string, unknown>;
  } catch (err) {
    console.error('Frontend Redis GET failed:', (err as Error).message);
    return null;
  }
}

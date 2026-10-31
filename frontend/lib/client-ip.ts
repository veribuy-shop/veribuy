import { isIP } from 'net';

/**
 * Resolve the real browser IP from X-Forwarded-For.
 *
 * Render's load balancer appends the connecting client's address, so the
 * trustworthy entry is counted from the RIGHT (TRUST_PROXY_HOPS, default 1).
 * Left-most entries are client-controlled and must never be trusted.
 */
export function resolveClientIp(
  forwardedFor: string | null | undefined,
  trustedHops = Number(process.env.TRUST_PROXY_HOPS ?? 1),
): string | null {
  if (!forwardedFor) return null;
  const entries = forwardedFor
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const hops = Number.isInteger(trustedHops) && trustedHops > 0 ? trustedHops : 1;
  const candidate = entries[entries.length - hops];
  return candidate && isIP(candidate) !== 0 ? candidate : null;
}

/** True if `url` targets the configured backend origin (and nothing else). */
export function isBackendUrl(url: string, backendUrl: string): boolean {
  try {
    return new URL(url).origin === new URL(backendUrl).origin;
  } catch {
    return false;
  }
}

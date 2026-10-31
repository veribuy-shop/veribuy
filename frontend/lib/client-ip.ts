/**
 * Edge- and Node-safe helpers for forwarding the real browser IP to the backend.
 * (No Node built-ins — this module is imported by middleware.)
 */

const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6_RE = /^[0-9a-f:.]+$/i;

export function isIpAddress(value: string): boolean {
  if (IPV4_RE.test(value)) return true;
  return value.includes(':') && value.length <= 45 && IPV6_RE.test(value);
}

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
  return candidate && isIpAddress(candidate) ? candidate : null;
}

/** True if `url` targets the configured backend origin (and nothing else). */
export function isBackendUrl(url: string, backendUrl: string): boolean {
  try {
    return new URL(url).origin === new URL(backendUrl).origin;
  } catch {
    return false;
  }
}

/**
 * HMAC-SHA256 over the client IP, verified by the backend rate limiter.
 * Uses Web Crypto so it runs in both the Edge (middleware) and Node runtimes.
 */
export async function signClientIp(ip: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`client-ip:${ip}`));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Headers that let the backend rate-limit by the real browser IP. */
export async function clientIpHeaders(forwardedFor: string | null): Promise<Record<string, string>> {
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  const ip = resolveClientIp(forwardedFor);
  if (!token || !ip) return {};
  return { 'x-client-ip': ip, 'x-client-ip-sig': await signClientIp(ip, token) };
}

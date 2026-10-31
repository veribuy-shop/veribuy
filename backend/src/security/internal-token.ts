import * as crypto from 'crypto';

/** Timing-safe check of the `x-internal-service` header against INTERNAL_SERVICE_TOKEN. */
export function isValidInternalToken(provided: string | string[] | undefined): boolean {
  const expected = process.env.INTERNAL_SERVICE_TOKEN;
  if (!expected || typeof provided !== 'string' || provided.length === 0) {
    return false;
  }
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Verifies the BFF's signature over a forwarded client IP. Uses a derived HMAC
 * (not the raw token) so the header can't be replayed to call internal endpoints.
 */
export function isValidClientIpSignature(ip: string, signature: string | string[] | undefined): boolean {
  const secret = process.env.INTERNAL_SERVICE_TOKEN;
  if (!secret || typeof signature !== 'string' || !/^[0-9a-f]{64}$/i.test(signature)) {
    return false;
  }
  const expected = crypto.createHmac('sha256', secret).update(`client-ip:${ip}`).digest();
  const provided = Buffer.from(signature, 'hex');
  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
}

import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { isIP } from 'net';
import { isValidClientIpSignature } from './internal-token';

/**
 * Rate-limits by the real end-user IP.
 *
 * Requests proxied by the Next.js BFF all originate from the BFF's address, so
 * the BFF forwards the browser's IP in `x-client-ip`, signed with an HMAC in
 * `x-client-ip-sig`. Unsigned or badly signed values are ignored and the caller
 * is keyed by their own connection IP (`req.ip`, resolved via `trust proxy`).
 */
@Injectable()
export class ClientAwareThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const forwarded = req.headers?.['x-client-ip'];
    if (typeof forwarded === 'string') {
      const ip = forwarded.trim();
      if (isIP(ip) !== 0 && isValidClientIpSignature(ip, req.headers?.['x-client-ip-sig'])) {
        return ip;
      }
    }
    return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
  }
}

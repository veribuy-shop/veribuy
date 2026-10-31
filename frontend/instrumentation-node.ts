/**
 * Server-side fetch instrumentation for BFF → backend calls.
 *
 * Every request the BFF proxies reaches the backend from the BFF's own IP, which
 * would make per-IP rate limits apply to all users at once. Here we attach the
 * real browser IP (`x-client-ip`) with an HMAC signature (`x-client-ip-sig`)
 * the backend verifies. The signature only vouches for the IP — it grants no
 * access to internal endpoints — and is only sent to the backend origin.
 */
import { createHmac } from 'crypto';
import { headers as requestHeaders } from 'next/headers';
import { getBackendUrl } from './lib/backend-url';
import { resolveClientIp, isBackendUrl } from './lib/client-ip';

export async function registerNodeFetchInstrumentation() {
  const originalFetch = globalThis.fetch;
  const backendUrl = getBackendUrl();

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const token = process.env.INTERNAL_SERVICE_TOKEN;

    if (token && isBackendUrl(url, backendUrl)) {
      let clientIp: string | null = null;
      try {
        clientIp = resolveClientIp((await requestHeaders()).get('x-forwarded-for'));
      } catch {
        // Outside a request scope (build, background work) — nothing to forward.
      }

      if (clientIp) {
        const merged = new Headers(input instanceof Request ? input.headers : undefined);
        new Headers(init?.headers).forEach((value, key) => merged.set(key, value));
        merged.set('x-client-ip', clientIp);
        merged.set('x-client-ip-sig', createHmac('sha256', token).update(`client-ip:${clientIp}`).digest('hex'));
        return originalFetch(input, { ...init, headers: merged });
      }
    }

    return originalFetch(input, init);
  };
}

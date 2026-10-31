import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import { resolveClientIp, isBackendUrl, signClientIp, isIpAddress } from '@/lib/client-ip';

describe('resolveClientIp', () => {
  it('takes the right-most entry appended by the proxy', () => {
    expect(resolveClientIp('1.2.3.4, 203.0.113.9', 1)).toBe('203.0.113.9');
  });

  it('ignores spoofed left-most entries', () => {
    expect(resolveClientIp('6.6.6.6, 6.6.6.7, 198.51.100.2', 1)).toBe('198.51.100.2');
  });

  it('honours multiple trusted hops', () => {
    expect(resolveClientIp('198.51.100.2, 10.0.0.1', 2)).toBe('198.51.100.2');
  });

  it('rejects missing or non-IP values', () => {
    expect(resolveClientIp(null)).toBeNull();
    expect(resolveClientIp('not-an-ip', 1)).toBeNull();
  });
});

describe('isBackendUrl', () => {
  it('matches only the exact backend origin', () => {
    expect(isBackendUrl('https://api.veribuy.shop/auth/login', 'https://api.veribuy.shop')).toBe(true);
    expect(isBackendUrl('https://api.veribuy.shop.evil.com/x', 'https://api.veribuy.shop')).toBe(false);
    expect(isBackendUrl('https://api.stripe.com/v1', 'https://api.veribuy.shop')).toBe(false);
  });
});

describe('signClientIp', () => {
  it('matches the HMAC the backend verifies', async () => {
    const expected = createHmac('sha256', 'secret').update('client-ip:203.0.113.9').digest('hex');
    expect(await signClientIp('203.0.113.9', 'secret')).toBe(expected);
  });
});

describe('isIpAddress', () => {
  it('accepts IPv4 and IPv6, rejects junk', () => {
    expect(isIpAddress('203.0.113.9')).toBe(true);
    expect(isIpAddress('2001:db8::1')).toBe(true);
    expect(isIpAddress('999.1.1.1')).toBe(false);
    expect(isIpAddress('evil.com')).toBe(false);
  });
});

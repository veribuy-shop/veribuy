import { describe, it, expect } from 'vitest';
import { resolveClientIp, isBackendUrl } from '@/lib/client-ip';

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

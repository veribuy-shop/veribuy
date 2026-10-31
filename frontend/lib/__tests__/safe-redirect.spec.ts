import { describe, it, expect } from 'vitest';
import { safeRedirectPath } from '@/lib/safe-redirect';

describe('safeRedirectPath', () => {
  it('keeps same-origin paths, including query strings', () => {
    expect(safeRedirectPath('/checkout?listingId=abc')).toBe('/checkout?listingId=abc');
  });

  it.each(['https://evil.com', '//evil.com', '/\\evil.com', ['javascript', 'alert(1)'].join(':'), 'evil.com', '/\nfoo'])(
    'rejects external or malformed target %s',
    (target) => {
      expect(safeRedirectPath(target)).toBe('/dashboard');
    },
  );

  it('falls back when no target is given', () => {
    expect(safeRedirectPath(null, '/admin')).toBe('/admin');
  });
});

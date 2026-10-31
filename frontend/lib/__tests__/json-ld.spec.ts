import { describe, it, expect } from 'vitest';
import { serializeJsonLd } from '@/lib/json-ld';

describe('serializeJsonLd', () => {
  it('cannot be broken out of with a closing script tag', () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
  });

  it('round-trips to the original data', () => {
    const data = { name: 'iPhone <15> & "Pro"', description: 'line\u2028sep' };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });
});

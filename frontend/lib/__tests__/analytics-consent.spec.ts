import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readAnalyticsChoice, saveAnalyticsChoice } from '../analytics-consent';

describe('analytics consent', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    });
  });

  it('has no choice until the visitor makes one', () => {
    expect(readAnalyticsChoice()).toBeNull();
  });

  it('remembers acceptance and rejection', () => {
    saveAnalyticsChoice('accepted');
    expect(readAnalyticsChoice()).toBe('accepted');
    saveAnalyticsChoice('rejected');
    expect(readAnalyticsChoice()).toBe('rejected');
  });

  it('asks again after a year', () => {
    const now = Date.now();
    saveAnalyticsChoice('accepted', now);
    expect(readAnalyticsChoice(now + 366 * 24 * 60 * 60 * 1000)).toBeNull();
  });

  it('treats unreadable or unknown values as no choice', () => {
    localStorage.setItem('veribuy-analytics-consent', 'not json');
    expect(readAnalyticsChoice()).toBeNull();
    localStorage.setItem('veribuy-analytics-consent', JSON.stringify({ choice: 'maybe', at: Date.now() }));
    expect(readAnalyticsChoice()).toBeNull();
  });

  it('copes with blocked storage', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(readAnalyticsChoice()).toBeNull();
    expect(() => saveAnalyticsChoice('accepted')).not.toThrow();
  });
});

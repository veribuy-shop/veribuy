import { checkoutMinutesLeft } from '@veribuy/common/checkout';

describe('checkout hold', () => {
  const start = new Date('2026-11-03T10:00:00Z');
  const after = (minutes: number) => start.getTime() + minutes * 60 * 1000;

  it('lasts as long as the server says', () => {
    expect(checkoutMinutesLeft(start, 10, after(0))).toBe(10);
    expect(checkoutMinutesLeft(start, 45, after(0))).toBe(45);
  });

  it('rounds part of a minute up, so a live hold never reads as zero', () => {
    expect(checkoutMinutesLeft(start, 45, after(44.5))).toBe(1);
  });

  it('stops at zero once the hold ends', () => {
    expect(checkoutMinutesLeft(start, 45, after(45))).toBe(0);
    expect(checkoutMinutesLeft(start, 45, after(90))).toBe(0);
  });
});

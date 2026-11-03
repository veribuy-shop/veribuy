import { restoreAfterRemask } from '../password-visibility';

describe('restoreAfterRemask', () => {
  it('keeps the text iOS wiped and adds the new character', () => {
    expect(restoreAfterRemask('abc', 'x')).toBe('abcx');
  });

  it('keeps the text when iOS sends the empty value', () => {
    expect(restoreAfterRemask('abc', '')).toBe('abc');
  });

  it('keeps every character of a burst of typing', () => {
    expect(restoreAfterRemask('abc', 'xy')).toBe('abcxy');
  });

  it('keeps a new character that matches the start of the text', () => {
    expect(restoreAfterRemask('abc', 'a')).toBe('abca');
  });

  it('leaves text alone when nothing was wiped', () => {
    expect(restoreAfterRemask('abc', 'abcx')).toBe('abcx');
  });

  it('handles a field that was already empty', () => {
    expect(restoreAfterRemask('', 'x')).toBe('x');
    expect(restoreAfterRemask('', '')).toBe('');
  });
});

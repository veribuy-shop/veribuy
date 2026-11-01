import { describe, it, expect } from 'vitest';
import { friendlyApiError } from '@/lib/api-errors';

describe('friendlyApiError', () => {
  it('hides whitelist errors behind a refresh prompt', () => {
    expect(
      friendlyApiError({ message: ['shippingAddress.property deliveryMethod should not exist'] }, 'Failed'),
    ).toBe('Something on this page is out of date. Please refresh and try again.');
  });

  it('rewrites class-validator rules with readable field names', () => {
    expect(friendlyApiError({ message: ['shippingAddress.postal_code should not be empty'] }, 'Failed')).toBe(
      'Please enter your postcode.',
    );
    expect(
      friendlyApiError({ message: ['shippingAddress.line1 must be longer than or equal to 5 characters'] }, 'Failed'),
    ).toBe('Your address line 1 must be at least 5 characters.');
  });

  it('dedupes and caps multiple messages', () => {
    const msg = friendlyApiError(
      { message: ['a should not be empty', 'a should not be empty', 'b should not be empty', 'c should not be empty'] },
      'Failed',
    );
    expect(msg).toBe('Please enter your a. Please enter your b.');
  });

  it('passes plain business messages through', () => {
    expect(friendlyApiError({ message: 'This listing is no longer available' }, 'Failed')).toBe(
      'This listing is no longer available',
    );
  });

  it('drops HTTP reason phrases that Nest adds alongside the message', () => {
    expect(
      friendlyApiError({ message: 'Another buyer is currently checking out this item.', error: 'Conflict', statusCode: 409 }, 'Failed'),
    ).toBe('Another buyer is currently checking out this item.');
  });

  it('falls back for technical or empty errors', () => {
    expect(friendlyApiError({ message: 'PrismaClientKnownRequestError: relation "x"' }, 'Failed')).toBe('Failed');
    expect(friendlyApiError({ error: 'Bad Request' }, 'Failed')).toBe('Failed');
    expect(friendlyApiError(null, 'Failed')).toBe('Failed');
  });
});

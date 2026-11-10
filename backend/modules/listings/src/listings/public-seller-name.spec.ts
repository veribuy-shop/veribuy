import { feedbackSummary, publicSellerName } from './listings.service';

describe('publicSellerName', () => {
  it('shows individuals by their username, never their name', () => {
    expect(publicSellerName({ username: 'SwiftOtter4821' })).toBe('SwiftOtter4821');
  });

  it('shows businesses by their company name', () => {
    expect(publicSellerName({ accountType: 'BUSINESS', companyName: 'E2E Refurb Ltd', username: 'CalmWren1200' }))
      .toBe('E2E Refurb Ltd');
  });

  it('falls back safely when nothing is known', () => {
    expect(publicSellerName(null)).toBe('VeriBuy seller');
    expect(publicSellerName({ username: null })).toBe('VeriBuy seller');
  });
});

describe('feedbackSummary', () => {
  it('starts a seller with no ratings at 100% positive', () => {
    expect(feedbackSummary([])).toEqual({ feedbackPercent: 100, feedbackCount: 0 });
  });

  it('counts 4 and 5 stars as positive', () => {
    expect(feedbackSummary([5, 4, 3, 1])).toEqual({ feedbackPercent: 50, feedbackCount: 4 });
  });
});

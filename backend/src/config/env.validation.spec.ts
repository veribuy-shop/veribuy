import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const baseDev = {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/veribuy',
    JWT_SECRET: 'a'.repeat(40),
    JWT_REFRESH_SECRET: 'b'.repeat(40),
    INTERNAL_SERVICE_TOKEN: 'c'.repeat(40),
  };

  const baseProd = {
    ...baseDev,
    NODE_ENV: 'production',
    ALLOWED_ORIGINS: 'https://www.veribuy.shop',
    STRIPE_SECRET_KEY: 'sk_live_abc123',
    STRIPE_WEBHOOK_SECRET: 'whsec_abc123',
  };

  it('accepts a valid development configuration', () => {
    expect(() => validateEnv(baseDev)).not.toThrow();
  });

  it('accepts a valid production configuration', () => {
    expect(() => validateEnv(baseProd)).not.toThrow();
  });

  it('rejects missing required secrets', () => {
    expect(() => validateEnv({ NODE_ENV: 'development' })).toThrow(/JWT_SECRET is required/);
  });

  it('rejects short secrets in production', () => {
    expect(() =>
      validateEnv({ ...baseProd, JWT_SECRET: 'short' }),
    ).toThrow(/at least 32 characters/);
  });

  it('rejects identical access and refresh secrets in production', () => {
    const shared = 'd'.repeat(40);
    expect(() =>
      validateEnv({ ...baseProd, JWT_SECRET: shared, JWT_REFRESH_SECRET: shared }),
    ).toThrow(/must not be identical/);
  });

  it('rejects placeholder secrets left over from .env.example', () => {
    expect(() =>
      validateEnv({ ...baseProd, INTERNAL_SERVICE_TOKEN: 'replace-with-an-internal-secret' }),
    ).toThrow(/placeholder value/);
  });

  it('refuses to enable AUTO_VERIFY_EMAIL in production', () => {
    expect(() =>
      validateEnv({ ...baseProd, AUTO_VERIFY_EMAIL: 'true' }),
    ).toThrow(/AUTO_VERIFY_EMAIL must not be enabled/);
  });

  it('rejects a wildcard CORS origin when credentials are enabled', () => {
    expect(() =>
      validateEnv({ ...baseProd, ALLOWED_ORIGINS: '*' }),
    ).toThrow(/must not contain "\*"/);
  });

  it('requires https origins in production', () => {
    expect(() =>
      validateEnv({ ...baseProd, ALLOWED_ORIGINS: 'http://insecure.example' }),
    ).toThrow(/must use https/);
  });

  it('warns (but does not block) a Stripe test key in production', () => {
    expect(() =>
      validateEnv({ ...baseProd, STRIPE_SECRET_KEY: 'sk_test_abc' }),
    ).not.toThrow();
  });

  it('rejects a malformed DATABASE_URL', () => {
    expect(() =>
      validateEnv({ ...baseDev, DATABASE_URL: 'mysql://localhost/db' }),
    ).toThrow(/must be a postgresql/);
  });

  it('rejects an out-of-range protection fee', () => {
    expect(() =>
      validateEnv({ ...baseDev, BUYER_PROTECTION_FEE_PERCENT: '150' }),
    ).toThrow(/between 0 and 100/);
  });
});

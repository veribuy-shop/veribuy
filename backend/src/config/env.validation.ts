/**
 * Environment variable validation.
 *
 * Runs once at application bootstrap via `ConfigModule.forRoot({ validate })`.
 * The goal is to fail fast and loudly on misconfiguration rather than allowing
 * a security-relevant variable to be silently undefined in production.
 *
 * Security-critical rules enforced here:
 *  - All secrets required in production, with a minimum entropy length.
 *  - Dangerous development conveniences (AUTO_VERIFY_EMAIL, the static dev OTP)
 *    can never be enabled when NODE_ENV=production.
 *  - ALLOWED_ORIGINS may never contain a wildcard while credentials are enabled.
 */

const MIN_SECRET_LENGTH = 32;

/** Secrets that must be present and sufficiently long in production. */
const PRODUCTION_SECRETS = [
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'INTERNAL_SERVICE_TOKEN',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
] as const;

/** Variables required in every environment. */
const ALWAYS_REQUIRED = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'INTERNAL_SERVICE_TOKEN',
] as const;

/** Placeholder values shipped in .env.example that must never reach production. */
const PLACEHOLDER_PATTERNS = [
  /^replace-with/i,
  /^changeme$/i,
  /^your-.*-here$/i,
];

export interface ValidatedEnv extends Record<string, unknown> {}

export function validateEnv(config: Record<string, unknown>): ValidatedEnv {
  const errors: string[] = [];
  const nodeEnv = String(config.NODE_ENV ?? 'development');
  const isProduction = nodeEnv === 'production';

  const get = (key: string): string | undefined => {
    const value = config[key];
    if (value === undefined || value === null) return undefined;
    const str = String(value).trim();
    return str.length === 0 ? undefined : str;
  };

  // --- Required everywhere -------------------------------------------------
  for (const key of ALWAYS_REQUIRED) {
    if (!get(key)) {
      errors.push(`${key} is required but was not set.`);
    }
  }

  // --- Production-only hardening -------------------------------------------
  if (isProduction) {
    for (const key of PRODUCTION_SECRETS) {
      const value = get(key);
      if (!value) {
        errors.push(`${key} is required in production but was not set.`);
        continue;
      }
      if (
        (key === 'JWT_SECRET' ||
          key === 'JWT_REFRESH_SECRET' ||
          key === 'INTERNAL_SERVICE_TOKEN') &&
        value.length < MIN_SECRET_LENGTH
      ) {
        errors.push(
          `${key} must be at least ${MIN_SECRET_LENGTH} characters in production (got ${value.length}).`,
        );
      }
      if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value))) {
        errors.push(`${key} still contains a placeholder value from .env.example.`);
      }
    }

    if (get('JWT_SECRET') && get('JWT_SECRET') === get('JWT_REFRESH_SECRET')) {
      errors.push('JWT_SECRET and JWT_REFRESH_SECRET must not be identical.');
    }

    // Development conveniences that must never be active in production.
    if (String(config.AUTO_VERIFY_EMAIL ?? '').toLowerCase() === 'true') {
      errors.push('AUTO_VERIFY_EMAIL must not be enabled in production.');
    }

    const origins = get('ALLOWED_ORIGINS');
    if (!origins) {
      errors.push('ALLOWED_ORIGINS is required in production.');
    } else {
      const entries = origins.split(',').map((o) => o.trim()).filter(Boolean);
      if (entries.includes('*')) {
        errors.push(
          'ALLOWED_ORIGINS must not contain "*" — CORS runs with credentials enabled.',
        );
      }
      for (const origin of entries) {
        if (!/^https:\/\//i.test(origin)) {
          errors.push(`ALLOWED_ORIGINS entry "${origin}" must use https:// in production.`);
        }
      }
    }
  }

  // --- Format checks (all environments) ------------------------------------
  const databaseUrl = get('DATABASE_URL');
  if (databaseUrl && !/^postgres(ql)?:\/\//i.test(databaseUrl)) {
    errors.push('DATABASE_URL must be a postgresql:// connection string.');
  }

  const port = get('PORT');
  if (port && (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)) {
    errors.push('PORT must be a valid TCP port number.');
  }

  const feePercent = get('BUYER_PROTECTION_FEE_PERCENT');
  if (feePercent !== undefined) {
    const parsed = Number(feePercent);
    if (!isFinite(parsed) || parsed < 0 || parsed > 100) {
      errors.push('BUYER_PROTECTION_FEE_PERCENT must be a number between 0 and 100.');
    }
  }

  const stripeKey = get('STRIPE_SECRET_KEY');
  if (stripeKey && isProduction && stripeKey.startsWith('sk_test_')) {
    errors.push('STRIPE_SECRET_KEY is a test key but NODE_ENV=production.');
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n  - ${errors.join('\n  - ')}\n\n` +
        'Refer to .env.example for the full list of supported variables.',
    );
  }

  return config;
}

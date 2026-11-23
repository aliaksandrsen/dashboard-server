import { describe, it, expect } from 'vitest';
import { Environment, validateEnv } from './env.validation.js';

describe('validateEnv', () => {
  const baseEnv = {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/dashboard?schema=public',
  };

  it('applies sensible defaults for optional variables in development', () => {
    const result = validateEnv(baseEnv);

    expect(result.NODE_ENV).toBe(Environment.Development);
    expect(result.PORT).toBe(3000);
    expect(result.DATABASE_URL).toBe(baseEnv.DATABASE_URL);
    expect(result.REDIS_HOST).toBe('localhost');
    expect(result.REDIS_PORT).toBe(6379);
    expect(result.STRIPE_SYNC_CRON).toBe('5 00 * * *');
    expect(result.STRIPE_SYNC_TIMEZONE).toBe('America/New_York');
    expect(result.THROTTLE_TTL_MS).toBe(60_000);
    expect(result.THROTTLE_LIMIT).toBe(100);
  });

  it('treats empty strings for optional variables as undefined and uses defaults', () => {
    const result = validateEnv({
      ...baseEnv,
      PORT: '',
      REDIS_PORT: '  ',
      STRIPE_SECRET_KEY: '',
    });

    expect(result.PORT).toBe(3000);
    expect(result.REDIS_PORT).toBe(6379);
    expect(result.STRIPE_SECRET_KEY).toBeUndefined();
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => validateEnv({})).toThrow('Invalid environment configuration');
  });

  it('throws when PORT or NODE_ENV is invalid', () => {
    expect(() => validateEnv({ ...baseEnv, PORT: '70000' })).toThrow(
      'Invalid environment configuration',
    );
    expect(() => validateEnv({ ...baseEnv, NODE_ENV: 'staging' })).toThrow(
      'Invalid environment configuration',
    );
  });

  it('requires STRIPE_SECRET_KEY in production', () => {
    expect(() => validateEnv({ ...baseEnv, NODE_ENV: 'production' })).toThrow(
      'Invalid environment configuration',
    );

    const prodResult = validateEnv({
      ...baseEnv,
      NODE_ENV: 'production',
      STRIPE_SECRET_KEY: 'sk_live_test_key',
    });
    expect(prodResult.NODE_ENV).toBe(Environment.Production);
    expect(prodResult.STRIPE_SECRET_KEY).toBe('sk_live_test_key');
  });

  it('throws when throttling values are out of range', () => {
    expect(() => validateEnv({ ...baseEnv, THROTTLE_TTL_MS: '500' })).toThrow(
      'Invalid environment configuration',
    );
    expect(() => validateEnv({ ...baseEnv, THROTTLE_LIMIT: '0' })).toThrow(
      'Invalid environment configuration',
    );
  });
});

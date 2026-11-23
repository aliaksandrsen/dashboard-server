import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { Cache } from 'cache-manager';
import { CacheHealthIndicator } from './cache.health.js';

describe('CacheHealthIndicator', () => {
  let indicator: CacheHealthIndicator;
  const mockCache = {
    set: vi.fn(),
    get: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    indicator = new CacheHealthIndicator(
      mockCache as unknown as Cache,
      new HealthIndicatorService(),
    );
  });

  it('returns status up when cache roundtrip succeeds', async () => {
    mockCache.set.mockResolvedValueOnce(undefined);
    mockCache.get.mockResolvedValueOnce('ok');

    const result = await indicator.isHealthy('cache');

    expect(mockCache.set).toHaveBeenCalledWith('health:ping', 'ok', 5000);
    expect(mockCache.get).toHaveBeenCalledWith('health:ping');
    expect(result).toEqual({ cache: { status: 'up' } });
  });

  it('returns status down when cache returns unexpected value', async () => {
    mockCache.set.mockResolvedValueOnce(undefined);
    mockCache.get.mockResolvedValueOnce(undefined);

    const result = await indicator.isHealthy('cache');

    expect(result).toEqual({
      cache: {
        status: 'down',
        message: 'Cache roundtrip check returned unexpected value',
      },
    });
  });

  it('returns status down when cache throws an error', async () => {
    mockCache.set.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await indicator.isHealthy('cache');

    expect(result).toEqual({
      cache: {
        status: 'down',
        message: 'ECONNREFUSED',
      },
    });
  });
});

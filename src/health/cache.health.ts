import { Inject, Injectable } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import type { Cache } from 'cache-manager';

const HEALTH_PING_KEY = 'health:ping';
const HEALTH_PING_TTL_MS = 5_000;

@Injectable()
export class CacheHealthIndicator {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    try {
      await this.cacheManager.set(HEALTH_PING_KEY, 'ok', HEALTH_PING_TTL_MS);
      const value = await this.cacheManager.get<string>(HEALTH_PING_KEY);

      if (value !== 'ok') {
        return indicator.down({ message: 'Cache roundtrip check returned unexpected value' });
      }

      return indicator.up();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Cache connection failed';
      return indicator.down({ message });
    }
  }
}

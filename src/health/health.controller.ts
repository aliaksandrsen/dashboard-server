import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
  type HealthCheckResult,
} from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../utils/prisma.service.js';
import { CacheHealthIndicator } from './cache.health.js';

@SkipThrottle()
@Controller({
  path: 'health',
  version: VERSION_NEUTRAL,
})
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly cacheHealth: CacheHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
      () => this.cacheHealth.isHealthy('cache'),
    ]);
  }

  @Get('live')
  liveness(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @HealthCheck()
  readiness(): Promise<HealthCheckResult> {
    return this.check();
  }
}

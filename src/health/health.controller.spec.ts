import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../utils/prisma.service.js';
import { CacheHealthIndicator } from './cache.health.js';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;

  const mockHealthCheckService = {
    check: vi.fn(),
  };
  const mockPrismaHealth = {
    pingCheck: vi.fn().mockResolvedValue({ database: { status: 'up' } }),
  };
  const mockCacheHealth = {
    isHealthy: vi.fn().mockResolvedValue({ cache: { status: 'up' } }),
  };
  const mockPrisma = {};

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthCheckService, useValue: mockHealthCheckService },
        { provide: PrismaHealthIndicator, useValue: mockPrismaHealth },
        { provide: CacheHealthIndicator, useValue: mockCacheHealth },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('runs database and cache health indicators on check()', async () => {
    mockHealthCheckService.check.mockImplementationOnce(
      async (indicators: Array<() => Promise<unknown>>) => {
        for (const fn of indicators) {
          await fn();
        }
        return {
          status: 'ok',
          details: { database: { status: 'up' }, cache: { status: 'up' } },
        };
      },
    );

    const result = await controller.check();

    expect(mockPrismaHealth.pingCheck).toHaveBeenCalledWith('database', mockPrisma);
    expect(mockCacheHealth.isHealthy).toHaveBeenCalledWith('cache');
    expect(result.status).toBe('ok');
  });

  it('delegates readiness() to check()', async () => {
    mockHealthCheckService.check.mockResolvedValueOnce({ status: 'ok' });

    const result = await controller.readiness();

    expect(mockHealthCheckService.check).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: 'ok' });
  });

  it('returns immediate ok response on liveness()', () => {
    const result = controller.liveness();

    expect(result.status).toBe('ok');
    expect(typeof result.timestamp).toBe('string');
  });
});

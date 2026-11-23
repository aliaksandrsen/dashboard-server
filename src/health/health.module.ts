import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { CacheHealthIndicator } from './cache.health.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [CacheHealthIndicator],
})
export class HealthModule {}

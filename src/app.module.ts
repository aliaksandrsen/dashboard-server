import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { createKeyv } from '@keyv/redis';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware.js';
import { validateEnv } from './config/env.validation.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './utils/prisma.module.js';
import { StripeModule } from './integrations/stripe/stripe.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { ProductsModule } from './products/products.module.js';
import { UsersModule } from './users/users.module.js';
import { JobsModule } from './jobs/jobs.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('THROTTLE_TTL_MS', 60_000),
            limit: config.get<number>('THROTTLE_LIMIT', 100),
          },
        ],
      }),
    }),
    PrismaModule,
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisHost = config.get<string>('REDIS_HOST', 'localhost');
        const redisPort = config.get<number>('REDIS_PORT', 6379);
        const redisUrl = config.get<string>('REDIS_URL') || `redis://${redisHost}:${redisPort}`;

        return {
          stores: [createKeyv(redisUrl)],
        };
      },
    }),
    HealthModule,
    StripeModule,
    OrdersModule,
    ProductsModule,
    UsersModule,
    JobsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('{*path}');
  }
}

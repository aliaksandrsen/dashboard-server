import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';
import { PrismaService } from './utils/prisma.service.js';
import { StripeModule } from './integrations/stripe/stripe.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { ProductsModule } from './products/products.module.js';
import { UsersModule } from './users/users.module.js';
import { JobsModule } from './jobs/jobs.module.js';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: () => {
        const redisHost = process.env.REDIS_HOST || 'localhost';
        const redisPort = process.env.REDIS_PORT || '6379';
        const redisUrl = process.env.REDIS_URL || `redis://${redisHost}:${redisPort}`;

        return {
          stores: [createKeyv(redisUrl)],
        };
      },
    }),
    StripeModule,
    OrdersModule,
    ProductsModule,
    UsersModule,
    JobsModule,
  ],
  providers: [PrismaService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaService } from './utils/prisma.service.js';
import { StripeModule } from './integrations/stripe/stripe.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { ProductsModule } from './products/products.module.js';
import { UsersModule } from './users/users.module.js';
import { JobsModule } from './jobs/jobs.module.js';

@Module({
  imports: [
    CacheModule.register({
      isGlobal: true,
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

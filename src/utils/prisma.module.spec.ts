import { describe, it, expect, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaModule } from './prisma.module.js';
import { PrismaService } from './prisma.service.js';
import { UsersModule } from '../users/users.module.js';
import { UsersService } from '../users/users.service.js';
import { ProductsModule } from '../products/products.module.js';
import { ProductsService } from '../products/products.service.js';
import { OrdersModule } from '../orders/orders.module.js';
import { OrdersService } from '../orders/orders.service.js';
import { JobsModule } from '../jobs/jobs.module.js';
import { TasksService } from '../jobs/crons/data-sync.cron.js';
import { StripeService } from '../integrations/stripe/stripe.service.js';

describe('PrismaModule & StripeModule singleton DI', () => {
  let moduleRef: TestingModule | undefined;

  afterEach(async () => {
    if (moduleRef) {
      await moduleRef.close();
      moduleRef = undefined;
    }
  });

  it('shares a single PrismaService instance and StripeService instance across all modules', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        CacheModule.register({ isGlobal: true }),
        PrismaModule,
        UsersModule,
        ProductsModule,
        OrdersModule,
        JobsModule,
      ],
    }).compile();

    const prisma = moduleRef.get(PrismaService);
    const stripe = moduleRef.get(StripeService);
    const usersService = moduleRef.get(UsersService);
    const productsService = moduleRef.get(ProductsService);
    const ordersService = moduleRef.get(OrdersService);
    const tasksService = moduleRef.get(TasksService);

    expect((usersService as unknown as { prisma: PrismaService }).prisma).toBe(prisma);
    expect((productsService as unknown as { prisma: PrismaService }).prisma).toBe(prisma);
    expect((ordersService as unknown as { prisma: PrismaService }).prisma).toBe(prisma);
    expect((tasksService as unknown as { prisma: PrismaService }).prisma).toBe(prisma);

    expect((productsService as unknown as { stripeService: StripeService }).stripeService).toBe(
      stripe,
    );
    expect((tasksService as unknown as { stripeService: StripeService }).stripeService).toBe(
      stripe,
    );
  });
});

import { Module } from '@nestjs/common';
import { PrismaService } from './utils/prisma.service.js';
import { StripeModule } from './integrations/stripe/stripe.module.js';
import { OrdersModule } from './orders/orders.module.js';

@Module({
  imports: [StripeModule, OrdersModule],
  providers: [PrismaService],
})
export class AppModule {}

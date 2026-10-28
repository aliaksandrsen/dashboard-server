import { Module } from '@nestjs/common';
import { PrismaService } from './utils/prisma.service.js';
import { StripeModule } from './integrations/stripe/stripe.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { ProductsModule } from './products/products.module.js';

@Module({
  imports: [StripeModule, OrdersModule, ProductsModule],
  providers: [PrismaService],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { PrismaService } from '../utils/prisma.service.js';
import { StripeModule } from '../integrations/stripe/stripe.module.js';

@Module({
  imports: [StripeModule],
  controllers: [ProductsController],
  providers: [ProductsService, PrismaService],
  exports: [ProductsService],
})
export class ProductsModule {}

import { Module } from '@nestjs/common';
import { OrdersController } from './orders/orders.controller.js';
import { OrdersService } from './orders/orders.service.js';
import { PrismaService } from './utils/prisma.service.js';

@Module({
  imports: [],
  controllers: [OrdersController],
  providers: [OrdersService, PrismaService],
})
export class AppModule {}

import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import type { Order } from '../../generated/prisma/client.js';
import { OrdersService } from './orders.service.js';
import { UpdateOrderDto } from './orders.interface.js';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  public async orders(): Promise<Array<Order>> {
    try {
      const orders = await this.ordersService.orders({});
      return orders;
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      throw new HttpException('Generic', HttpStatus.BAD_GATEWAY);
    }
  }

  @Patch(':id')
  public async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() order: UpdateOrderDto,
  ): Promise<Order> {
    try {
      return await this.ordersService.updateOrder({
        where: { id },
        data: order,
      });
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }
      throw new HttpException('Generic', HttpStatus.BAD_GATEWAY);
    }
  }
}

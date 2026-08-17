import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { Order } from '../../generated/prisma/client.js';
import { OrdersService } from './orders.service.js';
import {
  CreateOrderDto,
  OrderQueryDto,
  UpdateOrderDto,
} from './orders.interface.js';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async create(@Body() createOrderDto: CreateOrderDto): Promise<Order> {
    return await this.ordersService.create(createOrderDto);
  }

  @Get()
  public async findAll(@Query() query: OrderQueryDto): Promise<Array<Order>> {
    return await this.ordersService.findAll(query);
  }

  @Get(':id')
  public async findOne(@Param('id', ParseIntPipe) id: number): Promise<Order> {
    return await this.ordersService.findOne(id);
  }

  @Patch(':id')
  public async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateOrderDto: UpdateOrderDto,
  ): Promise<Order> {
    return await this.ordersService.update(id, updateOrderDto);
  }

  @Delete(':id')
  public async remove(@Param('id', ParseIntPipe) id: number): Promise<Order> {
    return await this.ordersService.remove(id);
  }
}

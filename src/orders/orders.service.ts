import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service.js';
import { UpdateOrderDto } from './orders.interface.js';
import { Order, Prisma } from '../../generated/prisma/client.js';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}
  private readonly logger = new Logger(OrdersService.name);

  public async orders(params: {
    skip?: number;
    take?: number;
    cursor?: Prisma.OrderWhereUniqueInput;
    where?: Prisma.OrderWhereInput;
    orderBy?: Prisma.OrderOrderByWithRelationInput;
    include?: Prisma.OrderInclude;
  }): Promise<Order[]> {
    const { skip, take, cursor, where, orderBy, include } = params;
    this.logger.log('GET /v1/orders requested');
    this.logger.log('Got all orders');
    return await this.prisma.order.findMany({
      skip,
      take,
      cursor,
      where,
      orderBy,
      include,
    });
  }

  public async updateOrder(params: {
    where: Prisma.OrderWhereUniqueInput;
    data: UpdateOrderDto;
  }): Promise<Order> {
    const { data, where } = params;
    this.logger.log(`Updated existing order ${where.id}`);

    try {
      const updatedOrder = await this.prisma.order.update({
        data: {
          total: data.total,
          userId: data.userId,
          products: {
            connect: data.products.map((product) => ({ id: product.id })),
          },
          updatedAt: new Date(),
        },
        where,
      });

      this.logger.log(
        `Updated for existing order ${updatedOrder.id} successful`,
      );

      return updatedOrder;
    } catch (err) {
      this.logger.log(`Updated for existing order ${where.id} failed`);

      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new HttpException(message, HttpStatus.CONFLICT);
    }
  }
}

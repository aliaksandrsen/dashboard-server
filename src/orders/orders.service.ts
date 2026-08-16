import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service';
import { UpdateOrderDto } from './orders.interface';
import { Order, Prisma } from '../../generated/prisma/client';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}
  private readonly logger = new Logger(OrdersService.name);

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

      throw new HttpException(err.message, HttpStatus.CONFLICT);
    }
  }
}

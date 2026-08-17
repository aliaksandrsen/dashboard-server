import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service.js';
import {
  CreateOrderDto,
  OrderQueryDto,
  UpdateOrderDto,
} from './orders.interface.js';
import { Order, Prisma } from '../../generated/prisma/client.js';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new order
   */
  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    const { total, userId, productIds } = createOrderDto;
    this.logger.log(`Creating new order for user ${userId}`);

    try {
      const order = await this.prisma.order.create({
        data: {
          total,
          userId,
          products: productIds?.length
            ? {
                connect: productIds.map((id) => ({ id })),
              }
            : undefined,
        },
        include: {
          user: true,
          products: true,
        },
      });

      this.logger.log(`Order #${order.id} created successfully`);
      return order;
    } catch (err: unknown) {
      this.logger.error('Failed to create order', err);
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2003' || err.code === 'P2025') {
          throw new BadRequestException(
            'Invalid userId or productId. Referenced record does not exist.',
          );
        }
      }
      throw new InternalServerErrorException('Failed to create order');
    }
  }

  /**
   * Find all orders with optional pagination and filtering
   */
  async findAll(query?: OrderQueryDto): Promise<Order[]> {
    const { skip, take, userId } = query ?? {};
    this.logger.log('Fetching orders list');

    return await this.prisma.order.findMany({
      skip,
      take,
      where: userId ? { userId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        user: true,
        products: true,
      },
    });
  }

  /**
   * Find a single order by ID
   */
  async findOne(id: number): Promise<Order> {
    this.logger.log(`Fetching order with id ${id}`);

    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: true,
        products: true,
      },
    });

    if (!order) {
      this.logger.warn(`Order #${id} not found`);
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  /**
   * Update an existing order (PATCH)
   */
  async update(id: number, updateOrderDto: UpdateOrderDto): Promise<Order> {
    this.logger.log(`Updating order #${id}`);

    // Verify order exists first
    await this.findOne(id);

    const { total, userId, productIds } = updateOrderDto;

    try {
      const updatedOrder = await this.prisma.order.update({
        where: { id },
        data: {
          total,
          userId,
          products:
            productIds !== undefined
              ? {
                  set: productIds.map((productId) => ({ id: productId })),
                }
              : undefined,
          updatedAt: new Date(),
        },
        include: {
          user: true,
          products: true,
        },
      });

      this.logger.log(`Order #${id} updated successfully`);
      return updatedOrder;
    } catch (err: unknown) {
      this.logger.error(`Failed to update order #${id}`, err);
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2003' || err.code === 'P2025') {
          throw new BadRequestException(
            'Invalid userId or productId provided. Record does not exist.',
          );
        }
      }
      throw new InternalServerErrorException('Failed to update order');
    }
  }

  /**
   * Delete an order by ID
   */
  async remove(id: number): Promise<Order> {
    this.logger.log(`Deleting order #${id}`);

    // Verify order exists first
    await this.findOne(id);

    try {
      const deletedOrder = await this.prisma.order.delete({
        where: { id },
      });

      this.logger.log(`Order #${id} deleted successfully`);
      return deletedOrder;
    } catch (err: unknown) {
      this.logger.error(`Failed to delete order #${id}`, err);
      throw new InternalServerErrorException('Failed to delete order');
    }
  }
}

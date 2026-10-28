import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service.js';
import {
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
} from './products.interface.js';
import { Product, Prisma } from '../../generated/prisma/client.js';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new product
   */
  async create(createProductDto: CreateProductDto): Promise<Product> {
    const { name, price, stripeProductId } = createProductDto;
    this.logger.log(`Creating new product: ${name}`);

    try {
      const product = await this.prisma.product.create({
        data: {
          name,
          price,
          stripeProductId,
        },
      });

      this.logger.log(`Product #${product.id} created successfully`);
      return product;
    } catch (err: unknown) {
      this.logger.error('Failed to create product', err);
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new BadRequestException(
            'A product with this stripeProductId already exists.',
          );
        }
      }
      throw new InternalServerErrorException('Failed to create product');
    }
  }

  /**
   * Find all products with optional pagination and search filtering
   */
  async findAll(query?: ProductQueryDto): Promise<Product[]> {
    const { skip, take, search } = query ?? {};
    this.logger.log('Fetching products list');

    return await this.prisma.product.findMany({
      skip,
      take,
      where: search
        ? {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find a single product by ID (UUID)
   */
  async findOne(id: string): Promise<Product> {
    this.logger.log(`Fetching product with id ${id}`);

    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      this.logger.warn(`Product #${id} not found`);
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }

  /**
   * Update an existing product (PATCH)
   */
  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    this.logger.log(`Updating product #${id}`);

    // Verify product exists first
    await this.findOne(id);

    const { name, price, stripeProductId } = updateProductDto;

    try {
      const updatedProduct = await this.prisma.product.update({
        where: { id },
        data: {
          name,
          price,
          stripeProductId,
          updatedAt: new Date(),
        },
      });

      this.logger.log(`Product #${id} updated successfully`);
      return updatedProduct;
    } catch (err: unknown) {
      this.logger.error(`Failed to update product #${id}`, err);
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new BadRequestException(
            'A product with this stripeProductId already exists.',
          );
        }
      }
      throw new InternalServerErrorException('Failed to update product');
    }
  }

  /**
   * Delete a product by ID
   */
  async remove(id: string): Promise<Product> {
    this.logger.log(`Deleting product #${id}`);

    // Verify product exists first
    await this.findOne(id);

    try {
      const deletedProduct = await this.prisma.product.delete({
        where: { id },
      });

      this.logger.log(`Product #${id} deleted successfully`);
      return deletedProduct;
    } catch (err: unknown) {
      this.logger.error(`Failed to delete product #${id}`, err);
      throw new InternalServerErrorException('Failed to delete product');
    }
  }
}

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../utils/prisma.service.js';
import { StripeService } from '../integrations/stripe/stripe.service.js';
import { CreateStripeProductDto } from '../integrations/stripe/stripe.interface.js';
import { CreateProductDto, ProductQueryDto, UpdateProductDto } from './products.interface.js';
import { Product, Prisma } from '../../generated/prisma/client.js';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

  /**
   * Two-phase product creation pipeline:
   * 1. Create product and price in Stripe (if stripeProductId is not provided).
   * 2. Persist product in PostgreSQL with the Stripe reference.
   * With automatic rollback in Stripe if database insertion fails.
   */
  async create(createProductDto: CreateProductDto): Promise<Product> {
    const { name, price, description, stripeProductId: existingStripeProductId } = createProductDto;

    this.logger.debug(
      `Started two-phase product creation pipeline with input:\n${JSON.stringify(createProductDto, null, 2)}`,
    );

    let stripeProductId = existingStripeProductId;
    let createdInStripe = false;

    // Phase 1: Register product in Stripe if not already provided
    if (!stripeProductId) {
      this.logger.log(`Phase 1: Creating product in Stripe for "${name}" ($${price})`);
      const stripeProductParams: CreateStripeProductDto = {
        name,
        price,
        description,
      };
      const stripeResult = await this.stripeService.createProduct(stripeProductParams);
      stripeProductId = stripeResult.stripeProductId;
      createdInStripe = true;
      this.logger.log(`Phase 1 completed: Stripe product created with id: ${stripeProductId}`);
    } else {
      this.logger.log(`Phase 1 skipped: Existing stripeProductId provided: ${stripeProductId}`);
    }

    // Phase 2: Persist in PostgreSQL
    const productRecord = {
      name,
      price,
      stripeProductId,
    };

    this.logger.log(
      `Phase 2: Creating database record in PostgreSQL:\n${JSON.stringify(productRecord, null, 2)}`,
    );

    try {
      const product = await this.prisma.product.create({
        data: productRecord,
      });

      this.logger.log(
        `Phase 2 completed: Product #${product.id} successfully created in PostgreSQL with stripeProductId: ${product.stripeProductId}`,
      );
      return product;
    } catch (err: unknown) {
      this.logger.error(
        `Phase 2 failed: Database insertion failed for product "${name}". Initiating compensation rollback...`,
        err,
      );

      // Rollback: Deactivate the created Stripe product to avoid orphaned active records
      if (createdInStripe && stripeProductId) {
        this.logger.warn(`Rollback: Deactivating orphaned Stripe product ${stripeProductId}`);
        await this.stripeService.deactivateProduct(stripeProductId);
      }

      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
          throw new BadRequestException('A product with this stripeProductId already exists.');
        }
      }
      throw new InternalServerErrorException('Failed to create product in database');
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
  async update(id: string, updateProductDto: UpdateProductDto): Promise<Product> {
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
          throw new BadRequestException('A product with this stripeProductId already exists.');
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

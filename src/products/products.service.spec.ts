import { vi, describe, beforeEach, it, expect } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service.js';
import { PrismaService } from '../utils/prisma.service.js';
import { StripeService } from '../integrations/stripe/stripe.service.js';
import { Product, Prisma } from '../../generated/prisma/client.js';

describe('ProductsService', () => {
  let service: ProductsService;

  const mockPrisma = {
    product: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  const mockStripeService = {
    createProduct: vi.fn(),
    deactivateProduct: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: StripeService, useValue: mockStripeService },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create (two-phase pipeline)', () => {
    it('should create product in Stripe first, then save to PostgreSQL', async () => {
      mockStripeService.createProduct.mockResolvedValueOnce({
        stripeProductId: 'prod_stripe_123',
        stripePriceId: 'price_stripe_456',
      });

      const mockCreatedProduct: Product = {
        id: 'uuid-1',
        name: 'Desk Lamp',
        price: 29.99,
        stripeProductId: 'prod_stripe_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.product.create.mockResolvedValueOnce(mockCreatedProduct);

      const result = await service.create({
        name: 'Desk Lamp',
        price: 29.99,
        description: 'LED Desk Lamp',
      });

      expect(mockStripeService.createProduct).toHaveBeenCalledWith({
        name: 'Desk Lamp',
        price: 29.99,
        description: 'LED Desk Lamp',
      });
      expect(mockPrisma.product.create).toHaveBeenCalledWith({
        data: {
          name: 'Desk Lamp',
          price: 29.99,
          stripeProductId: 'prod_stripe_123',
        },
      });
      expect(result).toEqual(mockCreatedProduct);
    });

    it('should skip Stripe creation if stripeProductId is already provided', async () => {
      const mockCreatedProduct: Product = {
        id: 'uuid-2',
        name: 'Chair',
        price: 99.0,
        stripeProductId: 'prod_pre_existing',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.product.create.mockResolvedValueOnce(mockCreatedProduct);

      const result = await service.create({
        name: 'Chair',
        price: 99.0,
        stripeProductId: 'prod_pre_existing',
      });

      expect(mockStripeService.createProduct).not.toHaveBeenCalled();
      expect(mockPrisma.product.create).toHaveBeenCalledWith({
        data: {
          name: 'Chair',
          price: 99.0,
          stripeProductId: 'prod_pre_existing',
        },
      });
      expect(result).toEqual(mockCreatedProduct);
    });

    it('should rollback and deactivate Stripe product if database insertion fails', async () => {
      mockStripeService.createProduct.mockResolvedValueOnce({
        stripeProductId: 'prod_stripe_rollback',
        stripePriceId: 'price_stripe_rollback',
      });

      mockPrisma.product.create.mockRejectedValueOnce(new Error('Database connection lost'));

      await expect(
        service.create({
          name: 'Broken Item',
          price: 15.0,
        }),
      ).rejects.toThrow('Failed to create product in database');

      expect(mockStripeService.deactivateProduct).toHaveBeenCalledWith('prod_stripe_rollback');
    });
  });

  describe('findAll, findOne, update, remove', () => {
    it('should return all products', async () => {
      mockPrisma.product.findMany.mockResolvedValueOnce([{ id: 'uuid-1' }] as never);
      const res = await service.findAll();
      expect(res).toEqual([{ id: 'uuid-1' }]);
    });

    it('should query products with search query', async () => {
      mockPrisma.product.findMany.mockResolvedValueOnce([{ id: 'uuid-1', name: 'Lamp' }] as never);
      const res = await service.findAll({ search: 'Lamp', skip: 0, take: 5 });
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
        skip: 0,
        take: 5,
        where: {
          name: { contains: 'Lamp', mode: 'insensitive' },
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(res).toEqual([{ id: 'uuid-1', name: 'Lamp' }]);
    });

    it('should return a single product by id', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: 'uuid-1',
      });
      const res = await service.findOne('uuid-1');
      expect(res).toEqual({ id: 'uuid-1' });
    });

    it('should throw NotFoundException if product is not found', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce(null);
      await expect(service.findOne('uuid-unknown')).rejects.toThrow(
        'Product with ID uuid-unknown not found',
      );
    });

    it('should update product', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: 'uuid-1',
      });
      mockPrisma.product.update.mockResolvedValueOnce({
        id: 'uuid-1',
        name: 'Updated',
      });

      const res = await service.update('uuid-1', { name: 'Updated' });
      expect(res).toEqual({ id: 'uuid-1', name: 'Updated' });
    });

    it('should throw BadRequestException if update violates unique stripeProductId (P2002)', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({ id: 'uuid-1' });
      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.10.1',
      });
      mockPrisma.product.update.mockRejectedValueOnce(p2002Error);

      await expect(service.update('uuid-1', { stripeProductId: 'prod_existing' })).rejects.toThrow(
        'A product with this stripeProductId already exists.',
      );
    });

    it('should throw InternalServerErrorException on generic update failure', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({ id: 'uuid-1' });
      mockPrisma.product.update.mockRejectedValueOnce(new Error('DB crash'));

      await expect(service.update('uuid-1', { name: 'Crash' })).rejects.toThrow(
        'Failed to update product',
      );
    });

    it('should delete product', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: 'uuid-1',
      });
      mockPrisma.product.delete.mockResolvedValueOnce({
        id: 'uuid-1',
      });

      const res = await service.remove('uuid-1');
      expect(res).toEqual({ id: 'uuid-1' });
    });

    it('should throw InternalServerErrorException on delete failure', async () => {
      mockPrisma.product.findUnique.mockResolvedValueOnce({ id: 'uuid-1' });
      mockPrisma.product.delete.mockRejectedValueOnce(new Error('Delete crash'));

      await expect(service.remove('uuid-1')).rejects.toThrow('Failed to delete product');
    });
  });
});

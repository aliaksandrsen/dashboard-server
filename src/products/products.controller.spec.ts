import { vi, describe, beforeEach, it, expect } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { Product } from '../../generated/prisma/client.js';

describe('ProductsController', () => {
  let controller: ProductsController;

  const mockProductsService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  const mockCacheManager = {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  };

  const sampleProduct: Product = {
    id: 'b6f69931-eeb7-4e02-b2f7-e6fbe5aa32db',
    name: 'Wireless Mouse',
    price: 49.99,
    stripeProductId: 'prod_mouse123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: mockProductsService,
        },
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create a product and invalidate cache', async () => {
    mockProductsService.create.mockResolvedValueOnce(sampleProduct);
    const dto = { name: 'Wireless Mouse', price: 49.99 };

    const result = await controller.create(dto);

    expect(mockProductsService.create).toHaveBeenCalledWith(dto);
    expect(mockCacheManager.del).toHaveBeenCalledWith('products');
    expect(result).toEqual(sampleProduct);
  });

  it('should findAll products', async () => {
    mockProductsService.findAll.mockResolvedValueOnce([sampleProduct]);
    const query = { skip: 0, take: 5, search: 'Mouse' };

    const result = await controller.findAll(query);

    expect(mockProductsService.findAll).toHaveBeenCalledWith(query);
    expect(result).toEqual([sampleProduct]);
  });

  it('should findOne product', async () => {
    mockProductsService.findOne.mockResolvedValueOnce(sampleProduct);

    const result = await controller.findOne(sampleProduct.id);

    expect(mockProductsService.findOne).toHaveBeenCalledWith(sampleProduct.id);
    expect(result).toEqual(sampleProduct);
  });

  it('should update a product and invalidate cache', async () => {
    const updated = { ...sampleProduct, price: 39.99 };
    mockProductsService.update.mockResolvedValueOnce(updated);

    const result = await controller.update(sampleProduct.id, { price: 39.99 });

    expect(mockProductsService.update).toHaveBeenCalledWith(sampleProduct.id, {
      price: 39.99,
    });
    expect(mockCacheManager.del).toHaveBeenCalledWith('products');
    expect(result).toEqual(updated);
  });

  it('should remove a product and invalidate cache', async () => {
    mockProductsService.remove.mockResolvedValueOnce(sampleProduct);

    const result = await controller.remove(sampleProduct.id);

    expect(mockProductsService.remove).toHaveBeenCalledWith(sampleProduct.id);
    expect(mockCacheManager.del).toHaveBeenCalledWith('products');
    expect(result).toEqual(sampleProduct);
  });
});

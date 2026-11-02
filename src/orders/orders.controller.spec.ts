import { vi, describe, beforeEach, it, expect } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';
import { Order } from '../../generated/prisma/client.js';

describe('OrdersController', () => {
  let controller: OrdersController;

  const mockOrdersService = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  };

  const sampleOrder: Order = {
    id: 1,
    total: 250.0,
    userId: 5,
    stripeInvoiceId: 'in_controller_test',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: OrdersService,
          useValue: mockOrdersService,
        },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should create an order', async () => {
    mockOrdersService.create.mockResolvedValueOnce(sampleOrder);
    const dto = { total: 250.0, userId: 5 };

    const result = await controller.create(dto);

    expect(mockOrdersService.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(sampleOrder);
  });

  it('should findAll orders', async () => {
    mockOrdersService.findAll.mockResolvedValueOnce([sampleOrder]);
    const query = { skip: 0, take: 10, userId: 5 };

    const result = await controller.findAll(query);

    expect(mockOrdersService.findAll).toHaveBeenCalledWith(query);
    expect(result).toEqual([sampleOrder]);
  });

  it('should findOne order', async () => {
    mockOrdersService.findOne.mockResolvedValueOnce(sampleOrder);

    const result = await controller.findOne(1);

    expect(mockOrdersService.findOne).toHaveBeenCalledWith(1);
    expect(result).toEqual(sampleOrder);
  });

  it('should update an order', async () => {
    const updated = { ...sampleOrder, total: 300.0 };
    mockOrdersService.update.mockResolvedValueOnce(updated);

    const result = await controller.update(1, { total: 300.0 });

    expect(mockOrdersService.update).toHaveBeenCalledWith(1, {
      total: 300.0,
    });
    expect(result).toEqual(updated);
  });

  it('should remove an order', async () => {
    mockOrdersService.remove.mockResolvedValueOnce(sampleOrder);

    const result = await controller.remove(1);

    expect(mockOrdersService.remove).toHaveBeenCalledWith(1);
    expect(result).toEqual(sampleOrder);
  });
});

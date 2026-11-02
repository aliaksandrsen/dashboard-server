import { vi, describe, beforeEach, it, expect } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { OrdersService } from './orders.service.js';
import { PrismaService } from '../utils/prisma.service.js';
import { Order, Prisma } from '../../generated/prisma/client.js';

describe('OrdersService', () => {
  let service: OrdersService;

  const mockPrisma = {
    order: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  const sampleOrder: Order = {
    id: 1,
    total: 150.0,
    userId: 10,
    stripeInvoiceId: 'in_test123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an order with product connections', async () => {
      mockPrisma.order.create.mockResolvedValueOnce(sampleOrder);

      const dto = {
        total: 150.0,
        userId: 10,
        stripeInvoiceId: 'in_test123',
        productIds: ['prod-uuid-1', 'prod-uuid-2'],
      };
      const result = await service.create(dto);

      expect(mockPrisma.order.create).toHaveBeenCalledWith({
        data: {
          total: 150.0,
          userId: 10,
          stripeInvoiceId: 'in_test123',
          products: {
            connect: [{ id: 'prod-uuid-1' }, { id: 'prod-uuid-2' }],
          },
        },
        include: {
          user: true,
          products: true,
        },
      });
      expect(result).toEqual(sampleOrder);
    });

    it('should create an order without product connections', async () => {
      mockPrisma.order.create.mockResolvedValueOnce(sampleOrder);

      const dto = {
        total: 50.0,
        userId: 10,
      };
      const result = await service.create(dto);

      expect(mockPrisma.order.create).toHaveBeenCalledWith({
        data: {
          total: 50.0,
          userId: 10,
          stripeInvoiceId: undefined,
          products: undefined,
        },
        include: {
          user: true,
          products: true,
        },
      });
      expect(result).toEqual(sampleOrder);
    });

    it('should throw BadRequestException on foreign key constraint error (P2003)', async () => {
      const p2003Error = new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        {
          code: 'P2003',
          clientVersion: '7.10.1',
        },
      );
      mockPrisma.order.create.mockRejectedValueOnce(p2003Error);

      await expect(
        service.create({ total: 100, userId: 99999 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      mockPrisma.order.create.mockRejectedValueOnce(
        new Error('Database error'),
      );

      await expect(service.create({ total: 100, userId: 10 })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('findAll', () => {
    it('should return all orders without query', async () => {
      mockPrisma.order.findMany.mockResolvedValueOnce([sampleOrder] as never);

      const result = await service.findAll();

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith({
        skip: undefined,
        take: undefined,
        where: undefined,
        orderBy: { createdAt: 'desc' },
        include: {
          user: true,
          products: true,
        },
      });
      expect(result).toEqual([sampleOrder]);
    });

    it('should filter orders by userId and pagination', async () => {
      mockPrisma.order.findMany.mockResolvedValueOnce([sampleOrder] as never);

      const query = { skip: 5, take: 10, userId: 10 };
      const result = await service.findAll(query);

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith({
        skip: 5,
        take: 10,
        where: { userId: 10 },
        orderBy: { createdAt: 'desc' },
        include: {
          user: true,
          products: true,
        },
      });
      expect(result).toEqual([sampleOrder]);
    });
  });

  describe('findOne', () => {
    it('should return the order when found', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce(sampleOrder);

      const result = await service.findOne(1);

      expect(mockPrisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: {
          user: true,
          products: true,
        },
      });
      expect(result).toEqual(sampleOrder);
    });

    it('should throw NotFoundException when order does not exist', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update an order with productIds set', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce(sampleOrder);
      const updatedOrder = { ...sampleOrder, total: 200.0 };
      mockPrisma.order.update.mockResolvedValueOnce(updatedOrder);

      const result = await service.update(1, {
        total: 200.0,
        productIds: ['prod-1'],
      });

      const updateCall = mockPrisma.order.update.mock.calls[0] as [
        {
          where: { id: number };
          data: { total?: number; products?: { set: { id: string }[] } };
        },
      ];
      expect(updateCall[0].where).toEqual({ id: 1 });
      expect(updateCall[0].data.total).toBe(200.0);
      expect(updateCall[0].data.products).toEqual({ set: [{ id: 'prod-1' }] });
      expect(result).toEqual(updatedOrder);
    });

    it('should throw NotFoundException if order to update does not exist', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce(null);

      await expect(service.update(999, { total: 100 })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if foreign key check fails during update', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce(sampleOrder);
      const p2003Error = new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        {
          code: 'P2003',
          clientVersion: '7.10.1',
        },
      );
      mockPrisma.order.update.mockRejectedValueOnce(p2003Error);

      await expect(service.update(1, { userId: 99999 })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw InternalServerErrorException on generic update failure', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce(sampleOrder);
      mockPrisma.order.update.mockRejectedValueOnce(new Error('fail'));

      await expect(service.update(1, { total: 10 })).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('remove', () => {
    it('should delete and return the order', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce(sampleOrder);
      mockPrisma.order.delete.mockResolvedValueOnce(sampleOrder);

      const result = await service.remove(1);

      expect(mockPrisma.order.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result).toEqual(sampleOrder);
    });

    it('should throw NotFoundException if order to remove does not exist', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });

    it('should throw InternalServerErrorException on deletion failure', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce(sampleOrder);
      mockPrisma.order.delete.mockRejectedValueOnce(new Error('fail'));

      await expect(service.remove(1)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});

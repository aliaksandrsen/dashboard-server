import { vi, describe, beforeEach, it, expect } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
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

    it('should propagate Prisma P2002 error to global exception filter', async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.10.1',
      });
      mockPrisma.order.create.mockRejectedValueOnce(p2002Error);

      await expect(service.create({ total: 100, stripeInvoiceId: 'in_duplicate' })).rejects.toBe(
        p2002Error,
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
    it('should check lightweight existence and update order with productIds set', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({ id: 1 });
      const updatedOrder = { ...sampleOrder, total: 200.0 };
      mockPrisma.order.update.mockResolvedValueOnce(updatedOrder);

      const result = await service.update(1, {
        total: 200.0,
        productIds: ['prod-1'],
      });

      expect(mockPrisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        select: { id: true },
      });
      expect(mockPrisma.order.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          total: 200.0,
          userId: undefined,
          stripeInvoiceId: undefined,
          products: { set: [{ id: 'prod-1' }] },
        },
        include: {
          user: true,
          products: true,
        },
      });
      expect(result).toEqual(updatedOrder);
    });

    it('should throw NotFoundException if order to update does not exist', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce(null);

      await expect(service.update(999, { total: 100 })).rejects.toThrow(NotFoundException);
    });

    it('should allow unassigning userId and clearing stripeInvoiceId with null', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({ id: 1 });
      const updatedOrder = { ...sampleOrder, userId: null, stripeInvoiceId: null };
      mockPrisma.order.update.mockResolvedValueOnce(updatedOrder);

      const result = await service.update(1, { userId: null, stripeInvoiceId: null });

      expect(mockPrisma.order.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            userId: null,
            stripeInvoiceId: null,
          }),
        }),
      );
      expect(result).toEqual(updatedOrder);
    });

    it('should throw BadRequestException if referenced productId does not exist (P2025)', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({ id: 1 });
      const p2025Error = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '7.10.1',
      });
      mockPrisma.order.update.mockRejectedValueOnce(p2025Error);

      await expect(service.update(1, { productIds: ['non-existent-uuid'] })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should propagate Prisma P2002 error during update to global exception filter', async () => {
      mockPrisma.order.findUnique.mockResolvedValueOnce({ id: 1 });
      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '7.10.1',
      });
      mockPrisma.order.update.mockRejectedValueOnce(p2002Error);

      await expect(service.update(1, { stripeInvoiceId: 'in_dup' })).rejects.toBe(p2002Error);
    });
  });

  describe('remove', () => {
    it('should delete and return the order directly without redundant findOne', async () => {
      mockPrisma.order.delete.mockResolvedValueOnce(sampleOrder);

      const result = await service.remove(1);

      expect(mockPrisma.order.findUnique).not.toHaveBeenCalled();
      expect(mockPrisma.order.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      });
      expect(result).toEqual(sampleOrder);
    });

    it('should propagate Prisma P2003 error on delete to global exception filter', async () => {
      const p2003Error = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: '7.10.1',
      });
      mockPrisma.order.delete.mockRejectedValueOnce(p2003Error);

      await expect(service.remove(1)).rejects.toBe(p2003Error);
    });
  });
});

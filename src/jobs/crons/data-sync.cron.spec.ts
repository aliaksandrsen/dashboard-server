import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerRegistry } from '@nestjs/schedule';
import { TasksService } from './data-sync.cron.js';
import { PrismaService } from '../../utils/prisma.service.js';

describe('TasksService', () => {
  let service: TasksService;

  const mockPrisma = {
    order: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  const mockCronJob = {
    start: jest.fn(),
    stop: jest.fn().mockReturnValue(Promise.resolve()),
  };

  const mockSchedulerRegistry = {
    addCronJob: jest.fn(),
    getCronJob: jest.fn().mockReturnValue(mockCronJob),
    deleteCronJob: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SchedulerRegistry, useValue: mockSchedulerRegistry },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addCronJob, stopCronJob, deleteCronJob', () => {
    it('should register and start a cron job in the registry', () => {
      const callback = jest.fn();
      service.addCronJob('test_job', '* * * * *', callback);

      expect(mockSchedulerRegistry.addCronJob).toHaveBeenCalledWith(
        'test_job',
        expect.anything(),
      );
    });

    it('should stop a cron job via registry', async () => {
      await service.stopCronJob('test_job');

      expect(mockSchedulerRegistry.getCronJob).toHaveBeenCalledWith('test_job');
      expect(mockCronJob.stop).toHaveBeenCalled();
    });

    it('should delete a cron job via registry', () => {
      service.deleteCronJob('test_job');

      expect(mockSchedulerRegistry.deleteCronJob).toHaveBeenCalledWith(
        'test_job',
      );
    });
  });

  describe('cronSyncStripeOrders', () => {
    it('should return processed=0 when Stripe returns no invoices', async () => {
      // Mock stripe invoices.list
      const stripeInvoicesListSpy = jest
        .spyOn(
          (service as unknown as { stripe: { invoices: { list: jest.Mock } } })
            .stripe.invoices,
          'list',
        )
        .mockResolvedValueOnce({ data: [] } as never);

      const result = await service.cronSyncStripeOrders();

      expect(stripeInvoicesListSpy).toHaveBeenCalled();
      expect(result).toEqual({ processed: 0, created: 0, skipped: 0 });
      expect(mockPrisma.order.create).not.toHaveBeenCalled();
    });

    it('should create order when invoice does not already exist in database', async () => {
      const mockInvoice = {
        id: 'in_123',
        total: 5000,
        customer_email: 'buyer@example.com',
      };

      jest
        .spyOn(
          (service as unknown as { stripe: { invoices: { list: jest.Mock } } })
            .stripe.invoices,
          'list',
        )
        .mockResolvedValueOnce({ data: [mockInvoice] } as never);

      mockPrisma.order.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 42,
        email: 'buyer@example.com',
      } as never);
      mockPrisma.order.create.mockResolvedValueOnce({ id: 1 } as never);

      const result = await service.cronSyncStripeOrders();

      expect(result).toEqual({ processed: 1, created: 1, skipped: 0 });
      expect(mockPrisma.order.create).toHaveBeenCalledWith({
        data: {
          stripeInvoiceId: 'in_123',
          total: 50,
          userId: 42,
        },
      });
    });

    it('should skip order creation when invoice already exists in database', async () => {
      const mockInvoice = {
        id: 'in_already_exists',
        total: 2000,
      };

      jest
        .spyOn(
          (service as unknown as { stripe: { invoices: { list: jest.Mock } } })
            .stripe.invoices,
          'list',
        )
        .mockResolvedValueOnce({ data: [mockInvoice] } as never);

      mockPrisma.order.findUnique.mockResolvedValueOnce({
        id: 99,
        stripeInvoiceId: 'in_already_exists',
      } as never);

      const result = await service.cronSyncStripeOrders();

      expect(result).toEqual({ processed: 1, created: 0, skipped: 1 });
      expect(mockPrisma.order.create).not.toHaveBeenCalled();
    });
  });
});

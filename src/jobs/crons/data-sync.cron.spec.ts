import { vi, describe, beforeEach, it, expect, type Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerRegistry } from '@nestjs/schedule';
import { TasksService } from './data-sync.cron.js';
import { PrismaService } from '../../utils/prisma.service.js';

describe('TasksService', () => {
  let service: TasksService;

  const mockPrisma = {
    order: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  };

  const mockCronJob = {
    start: vi.fn(),
    stop: vi.fn().mockReturnValue(Promise.resolve()),
  };

  const mockSchedulerRegistry = {
    addCronJob: vi.fn(),
    getCronJob: vi.fn().mockReturnValue(mockCronJob),
    deleteCronJob: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

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
      const callback = vi
        .fn<() => Promise<void>>()
        .mockResolvedValue(undefined);
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
      const stripeInvoicesListSpy = vi
        .spyOn(
          (service as unknown as { stripe: { invoices: { list: Mock } } })
            .stripe.invoices,
          'list',
        )
        .mockResolvedValueOnce({ data: [] });

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

      vi.spyOn(
        (service as unknown as { stripe: { invoices: { list: Mock } } }).stripe
          .invoices,
        'list',
      ).mockResolvedValueOnce({ data: [mockInvoice] });

      mockPrisma.order.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 42,
        email: 'buyer@example.com',
      });
      mockPrisma.order.create.mockResolvedValueOnce({ id: 1 });

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

      vi.spyOn(
        (service as unknown as { stripe: { invoices: { list: Mock } } }).stripe
          .invoices,
        'list',
      ).mockResolvedValueOnce({ data: [mockInvoice] });

      mockPrisma.order.findUnique.mockResolvedValueOnce({
        id: 99,
        stripeInvoiceId: 'in_already_exists',
      });

      const result = await service.cronSyncStripeOrders();

      expect(result).toEqual({ processed: 1, created: 0, skipped: 1 });
      expect(mockPrisma.order.create).not.toHaveBeenCalled();
    });
  });
});

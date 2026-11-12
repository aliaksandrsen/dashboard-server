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
    getCronJobs: vi.fn().mockReturnValue(new Map([['test_job', mockCronJob]])),
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
      const callback = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
      service.addCronJob('test_job', '* * * * *', callback);

      expect(mockSchedulerRegistry.addCronJob).toHaveBeenCalledWith('test_job', expect.anything());
    });

    it('should stop a cron job via registry', async () => {
      await service.stopCronJob('test_job');

      expect(mockSchedulerRegistry.getCronJob).toHaveBeenCalledWith('test_job');
      expect(mockCronJob.stop).toHaveBeenCalled();
    });

    it('should delete a cron job via registry', () => {
      service.deleteCronJob('test_job');

      expect(mockSchedulerRegistry.deleteCronJob).toHaveBeenCalledWith('test_job');
    });

    it('should initialize default sync cron job on onModuleInit', () => {
      const addCronJobSpy = vi.spyOn(service, 'addCronJob');
      service.onModuleInit();

      expect(addCronJobSpy).toHaveBeenCalledWith(
        'sync_stripe_orders',
        expect.any(String),
        expect.any(Function),
      );
    });

    it('should stop all registered cron jobs on onModuleDestroy', async () => {
      await service.onModuleDestroy();

      expect(mockSchedulerRegistry.getCronJobs).toHaveBeenCalled();
      expect(mockCronJob.stop).toHaveBeenCalled();
    });

    it('should handle error gracefully on onModuleDestroy', async () => {
      mockSchedulerRegistry.getCronJobs.mockImplementationOnce(() => {
        throw new Error('Registry failed');
      });

      await expect(service.onModuleDestroy()).resolves.toBeUndefined();
    });
  });

  describe('cronSyncStripeOrders', () => {
    it('should return processed=0 when Stripe returns no invoices', async () => {
      // Mock stripe invoices.list
      const stripeInvoicesListSpy = vi
        .spyOn(
          (service as unknown as { stripe: { invoices: { list: Mock } } }).stripe.invoices,
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
        (service as unknown as { stripe: { invoices: { list: Mock } } }).stripe.invoices,
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
        (service as unknown as { stripe: { invoices: { list: Mock } } }).stripe.invoices,
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

    it('should throw when stripe.invoices.list fails', async () => {
      vi.spyOn(
        (service as unknown as { stripe: { invoices: { list: Mock } } }).stripe.invoices,
        'list',
      ).mockRejectedValueOnce(new Error('Stripe API unreachable'));

      await expect(service.cronSyncStripeOrders()).rejects.toThrow('Stripe API unreachable');
    });

    it('should catch error and continue loop if single invoice processing fails', async () => {
      const mockInvoice = {
        id: 'in_bad',
        total: 1000,
      };

      vi.spyOn(
        (service as unknown as { stripe: { invoices: { list: Mock } } }).stripe.invoices,
        'list',
      ).mockResolvedValueOnce({ data: [mockInvoice] });

      mockPrisma.order.findUnique.mockRejectedValueOnce(new Error('DB read error'));

      const result = await service.cronSyncStripeOrders();
      expect(result).toEqual({ processed: 1, created: 0, skipped: 0 });
    });

    it('should handle invoice with null total and unknown customer email', async () => {
      const mockInvoice = {
        id: 'in_null_total',
        total: null,
        customer_email: 'unknown@example.com',
      };

      vi.spyOn(
        (service as unknown as { stripe: { invoices: { list: Mock } } }).stripe.invoices,
        'list',
      ).mockResolvedValueOnce({ data: [mockInvoice] });

      mockPrisma.order.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.order.create.mockResolvedValueOnce({ id: 2 });

      const result = await service.cronSyncStripeOrders();

      expect(result).toEqual({ processed: 1, created: 1, skipped: 0 });
      expect(mockPrisma.order.create).toHaveBeenCalledWith({
        data: {
          stripeInvoiceId: 'in_null_total',
          total: 0,
          userId: undefined,
        },
      });
    });
  });
});

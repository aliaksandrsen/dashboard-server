import { vi, describe, beforeEach, it, expect } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { JobsController } from './jobs.controller.js';
import { TasksService } from './crons/data-sync.cron.js';

describe('JobsController', () => {
  let controller: JobsController;

  const mockTasksService = {
    cronSyncStripeOrders: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [JobsController],
      providers: [
        {
          provide: TasksService,
          useValue: mockTasksService,
        },
      ],
    }).compile();

    controller = module.get<JobsController>(JobsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('triggerStripeSync', () => {
    it('should trigger stripe sync and return results', async () => {
      const mockResult = { processed: 5, created: 2, skipped: 3 };
      mockTasksService.cronSyncStripeOrders.mockResolvedValueOnce(mockResult);

      const response = await controller.triggerStripeSync();

      expect(mockTasksService.cronSyncStripeOrders).toHaveBeenCalled();
      expect(response).toEqual({
        message: 'Stripe orders synchronization triggered successfully',
        result: mockResult,
      });
    });
  });
});

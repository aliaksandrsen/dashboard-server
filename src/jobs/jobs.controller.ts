import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { SyncResult, TasksService } from './crons/data-sync.cron.js';

@Controller({
  path: 'jobs',
  version: '1',
})
export class JobsController {
  constructor(private readonly tasksService: TasksService) {}

  /**
   * Manually triggers the Stripe orders synchronization cron job.
   */
  @Post('sync-stripe')
  @HttpCode(HttpStatus.OK)
  async triggerStripeSync(): Promise<{
    message: string;
    result: SyncResult;
  }> {
    const result = await this.tasksService.cronSyncStripeOrders();
    return {
      message: 'Stripe orders synchronization triggered successfully',
      result,
    };
  }
}

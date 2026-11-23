import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { StripeModule } from '../integrations/stripe/stripe.module.js';
import { TasksService } from './crons/data-sync.cron.js';
import { JobsController } from './jobs.controller.js';

@Module({
  imports: [ScheduleModule.forRoot(), StripeModule],
  controllers: [JobsController],
  providers: [TasksService],
  exports: [TasksService],
})
export class JobsModule {}

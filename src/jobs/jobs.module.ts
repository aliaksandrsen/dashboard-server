import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaService } from '../utils/prisma.service.js';
import { TasksService } from './crons/data-sync.cron.js';
import { JobsController } from './jobs.controller.js';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [JobsController],
  providers: [PrismaService, TasksService],
  exports: [TasksService],
})
export class JobsModule {}

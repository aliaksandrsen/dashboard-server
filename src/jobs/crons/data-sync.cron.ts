import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import type Stripe from 'stripe';
import { CronJob } from 'cron';
import { StripeService } from '../../integrations/stripe/stripe.service.js';
import { PrismaService } from '../../utils/prisma.service.js';

export interface SyncResult {
  processed: number;
  created: number;
  skipped: number;
  failed: number;
}

@Injectable()
export class TasksService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const defaultCronSchedule = process.env.STRIPE_SYNC_CRON ?? '5 00 * * *';
    this.addCronJob('sync_stripe_orders', defaultCronSchedule, async () => {
      await this.cronSyncStripeOrders();
    });
  }

  async onModuleDestroy(): Promise<void> {
    try {
      const jobs = this.schedulerRegistry.getCronJobs();
      for (const [, job] of jobs) {
        await job.stop();
      }
    } catch (error) {
      this.logger.debug('Error stopping cron jobs on module destroy', error);
    }
  }

  /**
   * Adds and starts a dynamic cron job.
   *
   * @param name - Unique cron job identifier
   * @param cronExpression - Cron interval expression (e.g. '5 00 * * *')
   * @param callback - Async function executed on each tick
   */
  addCronJob(name: string, cronExpression: string, callback: () => Promise<void>): void {
    const timeZone = process.env.STRIPE_SYNC_TIMEZONE || 'America/New_York';
    const job = CronJob.from({
      cronTime: cronExpression,
      timeZone,
      unrefTimeout: true,
      onTick: async () => {
        try {
          await callback();
        } catch (error) {
          this.logger.error(`Error executing cron job ${name}:`, error);
        }
      },
    });

    this.schedulerRegistry.addCronJob(name, job);
    job.start();

    this.logger.log(
      `The cron job ${name} has been added with cron expression: ${cronExpression} (timezone: ${timeZone}).`,
    );
  }

  /**
   * Stops an active cron job by name.
   */
  async stopCronJob(name: string): Promise<void> {
    const job = this.schedulerRegistry.getCronJob(name);
    await job.stop();
    this.logger.log(`The cron job ${name} has been stopped.`);
  }

  /**
   * Deletes a registered cron job by name.
   */
  deleteCronJob(name: string): void {
    this.schedulerRegistry.deleteCronJob(name);
    this.logger.log(`The cron job ${name} has been deleted.`);
  }

  /**
   * Synchronizes paid Stripe invoices with the local database as Orders.
   *
   * @param syncDate - Reference date (defaults to current time)
   */
  async cronSyncStripeOrders(syncDate: Date = new Date()): Promise<SyncResult> {
    this.logger.debug(`Stripe orders sync started at ${new Date().toISOString()}`);

    // Compute previous 24 hours without mutating the input date
    const previousDate = new Date(syncDate.getTime() - 24 * 60 * 60 * 1000);
    // Stripe API expects Unix timestamp in seconds
    const previousTimestampSeconds = Math.floor(previousDate.getTime() / 1000);

    const params: Stripe.InvoiceListParams = {
      status: 'paid',
      created: {
        gte: previousTimestampSeconds,
      },
    };

    let latestInvoices: Stripe.Invoice[];
    try {
      latestInvoices = await this.stripeService.listInvoices(params);
    } catch (error) {
      this.logger.error('Failed to fetch invoices from Stripe', error);
      throw error;
    }

    if (latestInvoices.length === 0) {
      this.logger.debug(`No new Stripe invoices since ${previousDate.toISOString()}`);
      return { processed: 0, created: 0, skipped: 0, failed: 0 };
    }

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const invoice of latestInvoices) {
      try {
        const doesOrderRecordExist = await this.prisma.order.findUnique({
          where: { stripeInvoiceId: invoice.id },
        });

        if (!doesOrderRecordExist) {
          // Stripe invoice total is in cents; convert to currency unit
          const total = invoice.total != null ? invoice.total / 100 : 0;

          // Attempt to associate with an existing user via invoice customer email
          let userId: number | undefined;
          if (invoice.customer_email) {
            const user = await this.prisma.user.findUnique({
              where: { email: invoice.customer_email },
            });
            if (user) {
              userId = user.id;
            }
          }

          await this.prisma.order.create({
            data: {
              stripeInvoiceId: invoice.id,
              total,
              userId,
            },
          });
          created++;
          this.logger.log(`Created order record for Stripe invoice ${invoice.id}`);
        } else {
          skipped++;
        }
      } catch (error) {
        failed++;
        this.logger.error(`Something happened with invoice ${invoice.id}:`, error);
      }
    }

    this.logger.debug(`Stripe orders sync finished at ${new Date().toISOString()}`);
    return {
      processed: latestInvoices.length,
      created,
      skipped,
      failed,
    };
  }
}

import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import Stripe from 'stripe';
import {
  CreateStripePaymentDto,
  CreateStripeProductDto,
  StripeProductResult,
} from './stripe.interface.js';

export interface CreatePaymentParams {
  payment: CreateStripePaymentDto;
  origin: string;
  res: Response;
}

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);

  private readonly stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');

  /**
   * Creates a product and its associated price in Stripe.
   */
  public async createProduct(params: CreateStripeProductDto): Promise<StripeProductResult> {
    const { name, price, description, currency = 'usd' } = params;
    this.logger.debug(
      `Started product creation in Stripe with data:\n${JSON.stringify(params, null, 2)}`,
    );

    try {
      // 1. Create product in Stripe
      const productParams: Stripe.ProductCreateParams = {
        name,
        ...(description ? { description } : {}),
      };

      const productResponse = await this.stripe.products.create(productParams);

      this.logger.log(
        `Response from stripe.products.create SDK:\n${JSON.stringify(productResponse)}`,
      );

      // 2. Convert price to cents (integer)
      const unitAmount = Math.round(price * 100);

      this.logger.log(
        `Adding price info for product id: ${productResponse.id}, unit_amount: ${unitAmount}, currency: ${currency} via stripe.prices.create SDK`,
      );

      const priceResponse = await this.stripe.prices.create({
        product: productResponse.id,
        unit_amount: unitAmount,
        currency,
      });

      this.logger.log(`Response from stripe.prices.create SDK:\n${JSON.stringify(priceResponse)}`);

      return {
        stripeProductId: productResponse.id,
        stripePriceId: priceResponse.id,
      };
    } catch (err: unknown) {
      const errorDetails =
        err instanceof Error
          ? {
              name: err.name,
              message: err.message,
              stack: err.stack,
              ...(err as unknown as Record<string, unknown>),
            }
          : err;

      this.logger.error(
        `Stripe product creation failed with error:\n${JSON.stringify(errorDetails)}`,
      );

      throw new InternalServerErrorException(
        `Stripe service error: ${err instanceof Error ? err.message : 'Failed to create product in Stripe'}`,
      );
    }
  }

  /**
   * Deactivates a product in Stripe (used for rollback if downstream DB fails).
   */
  public async deactivateProduct(stripeProductId: string): Promise<void> {
    this.logger.warn(`Deactivating product in Stripe: ${stripeProductId}`);
    try {
      await this.stripe.products.update(stripeProductId, { active: false });
      this.logger.log(`Successfully deactivated product ${stripeProductId} in Stripe`);
    } catch (err: unknown) {
      this.logger.error(`Failed to deactivate product ${stripeProductId} in Stripe:`, err);
    }
  }

  public async createPayment({ payment, origin, res }: CreatePaymentParams): Promise<void> {
    this.logger.log('Starting Stripe payment');

    try {
      const session = await this.stripe.checkout.sessions.create({
        line_items: [
          {
            price: payment.priceId,
            quantity: payment.quantity,
          },
        ],
        mode: 'payment',
        success_url: `${origin}/?success=true`,
        cancel_url: `${origin}/?canceled=true`,
      });

      if (session.url) {
        res.status(303).redirect(session.url);
      } else {
        throw new Error('Failed to retrieve Stripe session URL');
      }
    } catch (error) {
      this.logger.error('Error creating Stripe payment', error);
      throw error;
    }
  }
}

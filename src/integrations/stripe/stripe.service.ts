import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import Stripe from 'stripe';
import { resolveAllowedOrigin } from '../../utils/origin.util.js';
import {
  CreateStripePaymentDto,
  CreateStripeProductDto,
  StripeCheckoutSessionResult,
  StripeProductResult,
} from './stripe.interface.js';

export interface CreatePaymentParams {
  payment: CreateStripePaymentDto;
  origin: string;
}

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);

  private readonly stripe: Stripe;

  constructor() {
    const apiKey = process.env.STRIPE_SECRET_KEY?.trim();

    if (!apiKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('STRIPE_SECRET_KEY environment variable is required in production');
      }

      this.logger.warn(
        'STRIPE_SECRET_KEY is not configured; Stripe API requests will fail unless mocked.',
      );
    }

    this.stripe = new Stripe(apiKey || 'sk_test_placeholder');
  }

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

  public async createPayment({
    payment,
    origin,
  }: CreatePaymentParams): Promise<StripeCheckoutSessionResult> {
    this.logger.log('Starting Stripe payment');

    const resolvedOrigin = resolveAllowedOrigin(origin);

    try {
      const session = await this.stripe.checkout.sessions.create({
        line_items: [
          {
            price: payment.priceId,
            quantity: payment.quantity,
          },
        ],
        mode: 'payment',
        success_url: `${resolvedOrigin}/?success=true`,
        cancel_url: `${resolvedOrigin}/?canceled=true`,
      });

      if (!session.url) {
        throw new BadGatewayException('Failed to retrieve Stripe session URL');
      }

      return {
        sessionId: session.id,
        url: session.url,
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error('Error creating Stripe payment', error);

      if (
        error instanceof Stripe.errors.StripeInvalidRequestError ||
        error instanceof Stripe.errors.StripeCardError
      ) {
        throw new BadRequestException(error.message);
      }

      throw new BadGatewayException('Failed to create Stripe payment session');
    }
  }

  /**
   * Lists all Stripe invoices matching the provided filters across all pages.
   */
  public async listInvoices(params: Stripe.InvoiceListParams): Promise<Stripe.Invoice[]> {
    const invoices: Stripe.Invoice[] = [];
    let startingAfter: string | undefined;

    try {
      while (true) {
        const response = await this.stripe.invoices.list({
          limit: 100,
          ...params,
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        });

        invoices.push(...response.data);

        if (!response.has_more || response.data.length === 0) {
          break;
        }

        startingAfter = response.data[response.data.length - 1]?.id;
        if (!startingAfter) {
          break;
        }
      }

      return invoices;
    } catch (err: unknown) {
      this.logger.error('Failed to fetch invoices from Stripe', err);
      throw err;
    }
  }
}

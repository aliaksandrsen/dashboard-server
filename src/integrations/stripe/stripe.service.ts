import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import Stripe from 'stripe';
import { CreateStripePaymentDto } from './stripe.interface.js';

export interface CreatePaymentParams {
  payment: CreateStripePaymentDto;
  origin: string;
  res: Response;
}

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);

  private readonly stripe = new Stripe(
    process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder',
  );

  public async createPayment({
    payment,
    origin,
    res,
  }: CreatePaymentParams): Promise<void> {
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

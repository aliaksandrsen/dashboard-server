import { Body, Controller, Headers, Post } from '@nestjs/common';
import { StripeService } from './stripe.service.js';
import { CreateStripePaymentDto, type StripeCheckoutSessionResult } from './stripe.interface.js';

@Controller({
  path: 'stripe',
  version: '1',
})
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @Post('/payments')
  public async createPayment(
    @Body() payment: CreateStripePaymentDto,
    @Headers('origin') origin: string | undefined,
  ): Promise<StripeCheckoutSessionResult> {
    return await this.stripeService.createPayment({
      payment,
      origin: origin ?? '',
    });
  }
}

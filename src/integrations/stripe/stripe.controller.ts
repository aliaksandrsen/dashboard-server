import { Body, Controller, Headers, HttpException, HttpStatus, Post } from '@nestjs/common';
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
    try {
      return await this.stripeService.createPayment({
        payment,
        origin: origin ?? '',
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'An error occurred while creating the payment';
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }
}

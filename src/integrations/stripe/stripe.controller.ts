import {
  Body,
  Controller,
  Headers,
  HttpException,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { StripeService } from './stripe.service.js';
import { CreateStripePaymentDto } from './stripe.interface.js';

@Controller('/v1/stripe')
export class StripeController {
  constructor(private readonly stripeService: StripeService) {}

  @Post('/payments')
  public async createPayment(
    @Body() payment: CreateStripePaymentDto,
    @Headers('origin') origin: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const paymentInfo = await this.stripeService.createPayment({
        payment,
        res,
        origin: origin ?? '',
      });

      return paymentInfo;
    } catch {
      throw new HttpException(
        'An error occurred while creating the payment',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}

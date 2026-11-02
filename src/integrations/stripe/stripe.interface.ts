import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export class CreateStripePaymentDto {
  @IsString()
  @IsNotEmpty()
  priceId!: string;

  @IsInt()
  @Min(1, {
    message: 'Quantity must be at least 1',
  })
  quantity!: number;
}

export class CreateStripeProductDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @IsPositive()
  price!: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  currency?: string;
}

export interface StripeProductResult {
  stripeProductId: string;
  stripePriceId: string;
}

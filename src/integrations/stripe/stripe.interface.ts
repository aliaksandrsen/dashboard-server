import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

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

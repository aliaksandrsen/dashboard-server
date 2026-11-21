import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderDto {
  @IsNumber()
  @IsPositive()
  total!: number;

  @IsInt()
  @IsPositive()
  @IsOptional()
  userId?: number;

  @IsString()
  @IsOptional()
  stripeInvoiceId?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  productIds?: string[];
}

export class UpdateOrderDto {
  @IsNumber()
  @IsPositive()
  @IsOptional()
  total?: number;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @IsPositive()
  userId?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  stripeInvoiceId?: string | null;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  productIds?: string[];
}

export class OrderQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  take?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  userId?: number;
}

import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  @IsPositive()
  price!: number;

  @IsString()
  @IsOptional()
  stripeProductId?: string;
}

export class UpdateProductDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsPositive()
  @IsOptional()
  price?: number;

  @IsString()
  @IsOptional()
  stripeProductId?: string;
}

export class ProductQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  skip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  take?: number;

  @IsOptional()
  @IsString()
  search?: string;
}

import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderDto {
  @IsNumber()
  @IsPositive()
  total!: number;

  @IsInt()
  @IsPositive()
  userId!: number;

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

  @IsInt()
  @IsPositive()
  @IsOptional()
  userId?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  productIds?: string[];
}

export class OrderQueryDto {
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
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  userId?: number;
}

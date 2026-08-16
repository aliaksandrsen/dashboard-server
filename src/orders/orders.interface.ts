import { IsNotEmpty, IsNumber } from 'class-validator';

type Product = {
  id: string;
  name: string;
  price: number;
  createdAt: Date;
  updatedAt: Date;
};

export class UpdateOrderDto {
  @IsNumber()
  total: number;

  @IsNotEmpty()
  products: Product[];

  @IsNotEmpty()
  userId: number;
}

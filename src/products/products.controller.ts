import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { Product } from '../../generated/prisma/client.js';
import { ProductsService } from './products.service.js';
import {
  CreateProductDto,
  ProductQueryDto,
  UpdateProductDto,
} from './products.interface.js';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async create(
    @Body() createProductDto: CreateProductDto,
  ): Promise<Product> {
    return await this.productsService.create(createProductDto);
  }

  @Get()
  public async findAll(
    @Query() query: ProductQueryDto,
  ): Promise<Array<Product>> {
    return await this.productsService.findAll(query);
  }

  @Get(':id')
  public async findOne(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Product> {
    return await this.productsService.findOne(id);
  }

  @Patch(':id')
  public async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    return await this.productsService.update(id, updateProductDto);
  }

  @Delete(':id')
  public async remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Product> {
    return await this.productsService.remove(id);
  }
}

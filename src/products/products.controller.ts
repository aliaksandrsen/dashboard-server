import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseInterceptors,
} from '@nestjs/common';
import { CACHE_MANAGER, CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import type { Product } from '../../generated/prisma/client.js';
import { ProductsService } from './products.service.js';
import { CreateProductDto, ProductQueryDto, UpdateProductDto } from './products.interface.js';

@Controller({
  path: 'products',
  version: '1',
})
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  public async create(@Body() createProductDto: CreateProductDto): Promise<Product> {
    const product = await this.productsService.create(createProductDto);
    await this.cacheManager.del('products');
    return product;
  }

  @UseInterceptors(CacheInterceptor)
  @CacheKey('products')
  @CacheTTL(30 * 1000)
  @Get()
  public async findAll(@Query() query: ProductQueryDto): Promise<Array<Product>> {
    return await this.productsService.findAll(query);
  }

  @Get(':id')
  public async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Product> {
    return await this.productsService.findOne(id);
  }

  @Patch(':id')
  public async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.productsService.update(id, updateProductDto);
    await this.cacheManager.del('products');
    return product;
  }

  @Delete(':id')
  public async remove(@Param('id', ParseUUIDPipe) id: string): Promise<Product> {
    const product = await this.productsService.remove(id);
    await this.cacheManager.del('products');
    return product;
  }
}

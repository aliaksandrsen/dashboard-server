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
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import type { Product } from '../../generated/prisma/client.js';
import { ProductsService } from './products.service.js';
import { CreateProductDto, ProductQueryDto, UpdateProductDto } from './products.interface.js';

const PRODUCTS_CACHE_KEY = 'products';
const PRODUCTS_CACHE_TTL_MS = 30 * 1000;

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
    await this.cacheManager.del(PRODUCTS_CACHE_KEY);
    return product;
  }

  @Get()
  public async findAll(@Query() query: ProductQueryDto): Promise<Array<Product>> {
    const hasQueryFilters = Boolean(
      query?.search?.trim() || query?.skip !== undefined || query?.take !== undefined,
    );

    if (!hasQueryFilters) {
      const cached = await this.cacheManager.get<Array<Product>>(PRODUCTS_CACHE_KEY);
      if (cached) {
        return cached;
      }

      const products = await this.productsService.findAll(query);
      await this.cacheManager.set(PRODUCTS_CACHE_KEY, products, PRODUCTS_CACHE_TTL_MS);
      return products;
    }

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
    await this.cacheManager.del(PRODUCTS_CACHE_KEY);
    return product;
  }

  @Delete(':id')
  public async remove(@Param('id', ParseUUIDPipe) id: string): Promise<Product> {
    const product = await this.productsService.remove(id);
    await this.cacheManager.del(PRODUCTS_CACHE_KEY);
    return product;
  }
}

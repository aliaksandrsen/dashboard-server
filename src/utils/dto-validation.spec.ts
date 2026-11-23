import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UserQueryDto, CreateUserDto } from '../users/users.interface.js';
import { ProductQueryDto } from '../products/products.interface.js';
import { OrderQueryDto } from '../orders/orders.interface.js';

describe('DTO & ValidationPipe constraints', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  it.each([
    ['UserQueryDto', UserQueryDto],
    ['ProductQueryDto', ProductQueryDto],
    ['OrderQueryDto', OrderQueryDto],
  ])('accepts take=100 and rejects take=101 for %s', async (_, dtoClass) => {
    const valid = await pipe.transform(
      { take: '100', skip: '0' },
      { type: 'query', metatype: dtoClass },
    );
    expect(valid).toMatchObject({ take: 100, skip: 0 });

    await expect(
      pipe.transform({ take: '101' }, { type: 'query', metatype: dtoClass }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects unknown extra fields when forbidNonWhitelisted is enabled', async () => {
    await expect(
      pipe.transform(
        {
          email: 'user@example.com',
          name: 'Valid User',
          address: '123 St',
          unexpectedField: 'hack',
        },
        { type: 'body', metatype: CreateUserDto },
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

describe('Orders (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableVersioning({
      type: VersioningType.URI,
    });
    await app.init();
  });

  it('/v1/orders (GET)', () => {
    return request(app.getHttpServer()).get('/v1/orders').expect(200);
  });

  it('/v1/jobs/sync-stripe (POST)', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/jobs/sync-stripe')
      .expect(200);

    const body = res.body as {
      message: string;
      result: { processed: number; created: number; skipped: number };
    };

    expect(body.message).toBe(
      'Stripe orders synchronization triggered successfully',
    );
    expect(typeof body.result.processed).toBe('number');
    expect(typeof body.result.created).toBe('number');
    expect(typeof body.result.skipped).toBe('number');
  });

  it('/v1/products (POST) creates product in Stripe and PostgreSQL', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/products')
      .send({
        name: `E2E Product ${Date.now()}`,
        price: 24.5,
        description: 'Automated E2E pipeline test product',
      })
      .expect(201);

    const product = res.body as {
      id: string;
      name: string;
      price: number;
      stripeProductId: string;
    };

    expect(product.id).toBeDefined();
    expect(product.price).toBe(24.5);
    expect(product.stripeProductId).toMatch(/^prod_/);
  });

  it('/v1/products (GET) caches products list and serves from cache', async () => {
    const res1 = await request(app.getHttpServer())
      .get('/v1/products')
      .expect(200);
    expect(Array.isArray(res1.body)).toBe(true);

    const res2 = await request(app.getHttpServer())
      .get('/v1/products')
      .expect(200);
    expect(res2.body).toEqual(res1.body);
  });

  afterEach(async () => {
    await app.close();
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { StripeService } from './../src/integrations/stripe/stripe.service.js';
import { TasksService } from './../src/jobs/crons/data-sync.cron.js';
import { createWinstonLogger } from './../src/utils/winston.logger.js';

describe('Dashboard Server API (e2e)', () => {
  let app: INestApplication<App>;

  const mockStripeService = {
    createProduct: vi.fn().mockImplementation(async ({ name }: { name: string }) => {
      const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      return {
        stripeProductId: `prod_e2e_${name.length}_${suffix}`,
        stripePriceId: `price_e2e_${name.length}_${suffix}`,
      };
    }),
    deactivateProduct: vi.fn().mockResolvedValue(undefined),
    createPayment: vi.fn().mockResolvedValue({
      sessionId: 'cs_e2e_123',
      url: 'https://checkout.stripe.com/pay/cs_e2e_123',
    }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StripeService)
      .useValue(mockStripeService)
      .compile();

    app = moduleFixture.createNestApplication({
      logger: createWinstonLogger(),
    });
    app.enableVersioning({
      type: VersioningType.URI,
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    const tasksService = app.get(TasksService);
    vi.spyOn(tasksService, 'cronSyncStripeOrders').mockResolvedValue({
      processed: 2,
      created: 1,
      skipped: 1,
      failed: 0,
    });

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('supports full Users CRUD, validation, max take, forbidNonWhitelisted, and 409 Conflict', async () => {
    const email = `e2e_user_${Date.now()}@example.com`;

    await request(app.getHttpServer())
      .post('/v1/users')
      .send({ email: 'not-an-email', name: '', address: '' })
      .expect(400);

    // Reject unknown extra properties (forbidNonWhitelisted)
    await request(app.getHttpServer())
      .post('/v1/users')
      .send({ email, name: 'E2E User', address: '123 Test Ave', extraField: 'forbidden' })
      .expect(400);

    // Reject excessive pagination limit (@Max(100))
    await request(app.getHttpServer()).get('/v1/users').query({ take: 101 }).expect(400);
    await request(app.getHttpServer()).get('/v1/products').query({ take: 101 }).expect(400);
    await request(app.getHttpServer()).get('/v1/orders').query({ take: 101 }).expect(400);

    const created = await request(app.getHttpServer())
      .post('/v1/users')
      .send({ email, name: 'E2E User', address: '123 Test Ave' })
      .expect(201);

    // Duplicate email returns 409 Conflict
    await request(app.getHttpServer())
      .post('/v1/users')
      .send({ email, name: 'Duplicate User', address: '456 Test Ave' })
      .expect(409);

    const userId = (created.body as { id: number }).id;
    expect(userId).toBeDefined();

    const fetched = await request(app.getHttpServer()).get(`/v1/users/${userId}`).expect(200);
    expect((fetched.body as { email: string }).email).toBe(email);

    const updated = await request(app.getHttpServer())
      .patch(`/v1/users/${userId}`)
      .send({ name: 'E2E User Updated' })
      .expect(200);
    expect((updated.body as { name: string }).name).toBe('E2E User Updated');

    await request(app.getHttpServer()).delete(`/v1/users/${userId}`).expect(200);
    await request(app.getHttpServer()).get(`/v1/users/${userId}`).expect(404);
  });

  it('supports Products CRUD, saves stripePriceId, and does not poison cache on search', async () => {
    const uniqueName = `E2E Unique Gadget ${Date.now()}`;

    const created = await request(app.getHttpServer())
      .post('/v1/products')
      .send({
        name: uniqueName,
        price: 24.5,
        description: 'Automated E2E product',
      })
      .expect(201);

    const product = created.body as {
      id: string;
      name: string;
      price: number;
      stripeProductId: string;
      stripePriceId: string;
    };

    expect(product.id).toBeDefined();
    expect(product.stripeProductId).toMatch(/^prod_e2e_/);
    expect(product.stripePriceId).toMatch(/^price_e2e_/);

    // Search query must NOT poison the unfiltered products cache
    const searchRes = await request(app.getHttpServer())
      .get('/v1/products')
      .query({ search: uniqueName })
      .expect(200);
    expect((searchRes.body as Array<{ id: string }>).some((p) => p.id === product.id)).toBe(true);

    const allRes = await request(app.getHttpServer()).get('/v1/products').expect(200);
    expect(Array.isArray(allRes.body)).toBe(true);
    expect((allRes.body as Array<{ id: string }>).length).toBeGreaterThanOrEqual(
      (searchRes.body as Array<{ id: string }>).length,
    );

    // Clearing stripe IDs with explicit null
    const cleared = await request(app.getHttpServer())
      .patch(`/v1/products/${product.id}`)
      .send({ stripeProductId: null, stripePriceId: null })
      .expect(200);
    expect((cleared.body as { stripeProductId: string | null }).stripeProductId).toBeNull();
    expect((cleared.body as { stripePriceId: string | null }).stripePriceId).toBeNull();

    await request(app.getHttpServer()).delete(`/v1/products/${product.id}`).expect(200);
  });

  it('supports Orders CRUD including unassigning userId and clearing stripeInvoiceId with null', async () => {
    const userRes = await request(app.getHttpServer())
      .post('/v1/users')
      .send({
        email: `order_owner_${Date.now()}@example.com`,
        name: 'Order Owner',
        address: '456 Order Rd',
      })
      .expect(201);
    const userId = (userRes.body as { id: number }).id;

    const orderRes = await request(app.getHttpServer())
      .post('/v1/orders')
      .send({
        total: 120.5,
        userId,
        stripeInvoiceId: `in_e2e_${Date.now()}`,
      })
      .expect(201);
    const orderId = (orderRes.body as { id: number }).id;

    const updated = await request(app.getHttpServer())
      .patch(`/v1/orders/${orderId}`)
      .send({ userId: null, stripeInvoiceId: null, total: 150 })
      .expect(200);

    const updatedBody = updated.body as {
      total: number;
      userId: number | null;
      stripeInvoiceId: string | null;
    };
    expect(updatedBody.total).toBe(150);
    expect(updatedBody.userId).toBeNull();
    expect(updatedBody.stripeInvoiceId).toBeNull();

    await request(app.getHttpServer()).delete(`/v1/orders/${orderId}`).expect(200);
    await request(app.getHttpServer()).delete(`/v1/users/${userId}`).expect(200);
  });

  it('/v1/stripe/payments (POST) returns checkout session URL JSON', async () => {
    const res = await request(app.getHttpServer())
      .post('/v1/stripe/payments')
      .set('Origin', 'http://localhost:5173')
      .send({ priceId: 'price_123', quantity: 2 })
      .expect(201);

    expect(res.body).toEqual({
      sessionId: 'cs_e2e_123',
      url: 'https://checkout.stripe.com/pay/cs_e2e_123',
    });
  });

  it('/v1/jobs/sync-stripe (POST) triggers sync', async () => {
    const res = await request(app.getHttpServer()).post('/v1/jobs/sync-stripe').expect(200);

    expect(res.body).toEqual({
      message: 'Stripe orders synchronization triggered successfully',
      result: { processed: 2, created: 1, skipped: 1, failed: 0 },
    });
  });
});

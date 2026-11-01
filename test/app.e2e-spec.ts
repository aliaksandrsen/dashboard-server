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

  afterEach(async () => {
    await app.close();
  });
});

import { INestApplication, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';

describe('Readiness endpoint (E2E)', () => {
  let app: INestApplication;

  async function createApp(overrides: {
    database?: 'ok' | 'error';
    redis?: 'ok' | 'error';
  }) {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: jest.fn(async () => {
          if (overrides.database === 'error') {
            throw new Error('database unavailable');
          }
          return [{ '?column?': 1 }];
        }),
        onModuleInit: jest.fn(),
        onModuleDestroy: jest.fn(),
      })
      .overrideProvider(RedisService)
      .useValue({
        ping: jest.fn(async () =>
          overrides.redis === 'error' ? 'ERROR' : 'PONG',
        ),
        onModuleDestroy: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  }

  afterEach(async () => {
    await app?.close();
  });

  it('returns 200 when database and redis are healthy', async () => {
    await createApp({ database: 'ok', redis: 'ok' });

    const response = await request(app.getHttpServer()).get('/api/v1/ready');

    expect(response.status).toBe(HttpStatus.OK);
    expect(response.body.status).toBe('ready');
  });

  it('returns 503 when a dependency is unavailable', async () => {
    await createApp({ database: 'error', redis: 'ok' });

    const response = await request(app.getHttpServer()).get('/api/v1/ready');

    expect(response.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(response.body.status).toBe('degraded');
    expect(response.body.checks.database.status).toBe('error');
  });
});

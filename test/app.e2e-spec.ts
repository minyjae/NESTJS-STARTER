import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '@/shared/services/prisma/prisma.service';
import { RedisService } from '@/shared/services/redis/redis.service';

interface HealthResponseBody {
  statusCode: number;
  message: string;
  data: {
    status: string;
  };
}

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/nest_starter';
    process.env.JWT_SECRET = 'test-secret';
    process.env.REDIS_REQUIRED = 'false';

    const { AppModule } = await import('@/app.module');
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        user: {},
      })
      .overrideProvider(RedisService)
      .useValue({
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        deleteByPattern: jest.fn(),
        getOrSet: jest.fn(),
        generateKey: jest.fn(),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('/api/v1/health (GET)', async () => {
    const server = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(server).get('/api/v1/health').expect(200);
    const body = response.body as HealthResponseBody;

    expect(body.statusCode).toBe(200);
    expect(body.message).toBe('Success');
    expect(body.data.status).toBe('ok');
  });
});

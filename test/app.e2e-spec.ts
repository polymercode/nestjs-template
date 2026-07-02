import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Global, INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { CacheModule } from '../src/cache/cache.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Ensure required env vars exist even when no .env file is present (e.g. CI).
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test?schema=public';
process.env.JWT_ACCESS_SECRET ??= 'e2e-access-secret-at-least-16-chars';
process.env.JWT_REFRESH_SECRET ??= 'e2e-refresh-secret-at-least-16-chars';
// Never dialed — the whole CacheModule is swapped out for TestCacheModule below.
process.env.REDIS_URL ??= 'redis://localhost:6379';

/** In-memory stand-in for the Redis-backed CACHE_MANAGER. */
function createCacheMock() {
  const store = new Map<string, unknown>();
  return {
    get: jest.fn((key: string) => Promise.resolve(store.get(key))),
    set: jest.fn((key: string, value: unknown) => {
      store.set(key, value);
      return Promise.resolve();
    }),
    del: jest.fn((key: string) => {
      store.delete(key);
      return Promise.resolve();
    }),
  };
}

/**
 * Replaces the real CacheModule entirely so its Redis-backed factory never
 * runs — swapping just the CACHE_MANAGER provider isn't enough since the
 * factory that constructs the Redis client executes during module init.
 */
@Global()
@Module({
  providers: [{ provide: CACHE_MANAGER, useValue: createCacheMock() }],
  exports: [CACHE_MANAGER],
})
class TestCacheModule {}

/**
 * In-memory PrismaService stand-in so e2e tests exercise the full HTTP
 * pipeline (guards, pipes, filters) without a real database.
 */
function createPrismaMock() {
  const users = new Map<string, any>();
  let sequence = 0;

  return {
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn().mockResolvedValue([{ ok: 1 }]),
    user: {
      findUnique: jest.fn(({ where }: any) => {
        if (where.id) return Promise.resolve(users.get(where.id) ?? null);
        const match = [...users.values()].find((u) => u.email === where.email) ?? null;
        return Promise.resolve(match);
      }),
      findMany: jest.fn(() => Promise.resolve([...users.values()])),
      create: jest.fn(({ data }: any) => {
        sequence += 1;
        const user = {
          id: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
          name: null,
          role: 'USER',
          refreshToken: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        users.set(user.id, user);
        return Promise.resolve(user);
      }),
      update: jest.fn(({ where, data }: any) => {
        const user = users.get(where.id);
        if (!user) return Promise.reject(new Error('Record not found'));
        Object.assign(user, data, { updatedAt: new Date() });
        return Promise.resolve(user);
      }),
    },
  };
}

describe('Application (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(createPrismaMock())
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .compile();

    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('health', () => {
    it('GET /api/v1/health responds without auth', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.database).toBe('up');
    });
  });

  describe('auth + users flow', () => {
    const credentials = { email: 'e2e@example.com', password: 'Str0ngP@ssword', name: 'E2E' };
    let accessToken: string;
    let refreshToken: string;

    it('rejects unauthenticated access to protected routes', async () => {
      await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
    });

    it('rejects registration with an invalid payload', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'not-an-email', password: 'short' })
        .expect(400);
    });

    it('registers a new user and returns a token pair', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(credentials)
        .expect(201);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
    });

    it('rejects duplicate registration', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(credentials)
        .expect(409);
    });

    it('logs in with valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: credentials.email, password: credentials.password })
        .expect(200);

      accessToken = res.body.accessToken;
      refreshToken = res.body.refreshToken;
    });

    it('rejects login with a wrong password', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: credentials.email, password: 'WrongPassword1!' })
        .expect(401);
    });

    it('returns the profile with a valid access token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.email).toBe(credentials.email);
      expect(res.body.password).toBeUndefined();
      expect(res.body.refreshToken).toBeUndefined();
    });

    it('forbids non-admin users from listing users', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });

    it('rotates tokens via refresh', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      refreshToken = res.body.refreshToken;
    });

    it('invalidates the refresh token on logout', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(403);
    });
  });
});

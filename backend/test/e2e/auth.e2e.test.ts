import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../../src/app.module';

describe('Auth E2E', () => {
  let app: INestApplication;
  const ts = Date.now();
  const email = `e2e-${ts}@example.com`;
  const password = 'Passw0rd123';
  let accessToken = '';
  let refreshToken = '';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();

    // ─── Mirror main.ts global setup ───
    const { Reflector } = await import('@nestjs/core');
    const { ResponseInterceptor, AllExceptionsFilter, LoggerService } = await import('../../src/common');

    const reflector = app.get(Reflector);

    // Interceptors
    app.useGlobalInterceptors(new ResponseInterceptor(reflector));

    // Filters
    app.useGlobalFilters(new AllExceptionsFilter());

    // Pipes
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  // ─── REGISTER ───
  describe('POST /auth/register', () => {
    it('should register new user', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password, fullName: 'E2E User' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(email);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('should reject duplicate email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email, password, fullName: 'Dup' })
        .expect(409);

      expect(res.body.success).toBe(false);
    });

    it('should reject invalid email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'bad', password, fullName: 'X' })
        .expect(400);
    });

    it('should reject short password', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: `x${ts}@x.com`, password: '123', fullName: 'X' })
        .expect(400);
    });
  });

  // ─── LOGIN ───
  describe('POST /auth/login', () => {
    it('should login with correct credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password })
        .expect(200);

      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      accessToken = res.body.data.accessToken;
      refreshToken = res.body.data.refreshToken;
    });

    it('should reject wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'WrongPass123' })
        .expect(401);

      expect(res.body.error.code).toBe('AUTH_INVALID_CREDENTIALS');
    });
  });

  // ─── PROTECTED ───
  describe('GET /users/me', () => {
    it('should reject without token', async () => {
      const res = await request(app.getHttpServer()).get('/users/me');
      expect([400, 401]).toContain(res.status);
    });

    it('should return profile with token', async () => {
      const res = await request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.data.email).toBe(email);
    });
  });

  // ─── REFRESH ───
  describe('POST /auth/refresh', () => {
    it('should issue new token pair', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken });

      // Should succeed on first use
      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).not.toBe(refreshToken);
    });

    it('should reject old refresh (reuse detection)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken });

      // Accept 400 or 401 — both indicate invalid token
      expect([400, 401]).toContain(res.status);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });
  });
});

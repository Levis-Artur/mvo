import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { AddressInfo } from 'node:net';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('public routes', () => {
  let app: INestApplication;
  let baseUrl: string;

  const login = jest.fn();
  const changePasswordPreAuth = jest.fn();
  const authenticateSession = jest.fn();
  const queryRaw = jest.fn();

  beforeAll(async () => {
    process.env.API_PORT = '3001';
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    process.env.DATABASE_URL =
      'postgresql://test:test@localhost:5432/test?schema=public';

    const { AppModule } = await import('../app.module');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: queryRaw,
        securityEvent: { create: jest.fn() },
      })
      .overrideProvider(AuthService)
      .useValue({
        authenticateSession,
        changePasswordPreAuth,
        login,
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    login.mockResolvedValue({
      requiresPreAuth: true,
      stage: 'VERIFY_2FA',
      preAuthToken: 'pre-auth-token',
      user: {
        id: 'owner-id',
        username: 'owner',
        role: 'OWNER',
      },
    });
    changePasswordPreAuth.mockResolvedValue({
      requiresPreAuth: true,
      stage: 'ENROLL_2FA',
      preAuthToken: 'next-pre-auth-token',
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows GET /api/health without a session', async () => {
    const response = await fetch(`${baseUrl}/api/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ok',
      service: 'mvo-inventory-api',
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('allows POST /api/auth/login to reach AuthService without a session', async () => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        username: 'owner',
        password: 'correct-password-123',
      }),
    });

    expect(response.status).toBe(201);
    expect(login).toHaveBeenCalledWith(
      'owner',
      'correct-password-123',
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
    );
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await response.json()).toEqual({
      requiresPreAuth: true,
      stage: 'VERIFY_2FA',
      preAuthToken: 'pre-auth-token',
      user: {
        id: 'owner-id',
        username: 'owner',
        role: 'OWNER',
      },
    });
  });

  it('rejects a protected endpoint without a session', async () => {
    const response = await fetch(`${baseUrl}/api/auth/me`);

    expect(response.status).toBe(401);
  });

  it('changes a pre-auth password without setting a session cookie', async () => {
    const response = await fetch(
      `${baseUrl}/api/auth/pre-auth/change-password`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          preAuthToken: 'change-password-token',
          newPassword: 'new-secure-password-123',
        }),
      },
    );

    expect(response.status).toBe(201);
    expect(changePasswordPreAuth).toHaveBeenCalledWith(
      'change-password-token',
      'new-secure-password-123',
    );
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await response.json()).toEqual({
      requiresPreAuth: true,
      stage: 'ENROLL_2FA',
      preAuthToken: 'next-pre-auth-token',
    });
  });

  it('@Public() does not expose other routes', async () => {
    const response = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
    });

    expect(response.status).toBe(401);
    expect(authenticateSession).not.toHaveBeenCalled();
  });

  it('rejects my-property CSV export without a session', async () => {
    const response = await fetch(`${baseUrl}/api/stock/my-property/export.csv`);

    expect(response.status).toBe(401);
  });
});

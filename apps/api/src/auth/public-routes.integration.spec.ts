import { UnauthorizedException, ValidationPipe } from '@nestjs/common';
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
  const beginTwoFactorEnrollment = jest.fn();
  const confirmTwoFactorEnrollment = jest.fn();
  const verifyTwoFactor = jest.fn();
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
        beginTwoFactorEnrollment,
        changePasswordPreAuth,
        confirmTwoFactorEnrollment,
        login,
        verifyTwoFactor,
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
    beginTwoFactorEnrollment.mockResolvedValue({
      otpauthUrl: 'otpauth://totp/MVO%20Inventory%3Aowner',
      manualKey: 'MANUALKEY',
    });
    confirmTwoFactorEnrollment.mockResolvedValue({
      authenticated: true,
      recoveryCodes: Array.from(
        { length: 10 },
        (_, index) => `CODE-${index + 1}`,
      ),
      user: {
        id: 'owner-id',
        username: 'owner',
        role: 'OWNER',
      },
      session: {
        token: 'authenticated-session-token',
        expiresAt: new Date('2026-07-17T00:00:00.000Z'),
      },
    });
    verifyTwoFactor.mockResolvedValue({
      authenticated: true,
      user: {
        id: 'owner-id',
        username: 'owner',
        role: 'OWNER',
      },
      session: {
        token: 'verified-session-token',
        expiresAt: new Date('2026-07-17T00:00:00.000Z'),
      },
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

  it('begins 2FA enrollment without setting a session cookie', async () => {
    const response = await fetch(`${baseUrl}/api/auth/pre-auth/2fa/enroll`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ preAuthToken: 'enroll-token' }),
    });

    expect(response.status).toBe(201);
    expect(beginTwoFactorEnrollment).toHaveBeenCalledWith('enroll-token');
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await response.json()).toEqual({
      otpauthUrl: 'otpauth://totp/MVO%20Inventory%3Aowner',
      manualKey: 'MANUALKEY',
    });
  });

  it('confirms 2FA and sets the authenticated session cookie', async () => {
    const response = await fetch(`${baseUrl}/api/auth/pre-auth/2fa/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        preAuthToken: 'enroll-token',
        token: '123456',
      }),
    });

    expect(response.status).toBe(201);
    expect(confirmTwoFactorEnrollment).toHaveBeenCalledWith(
      'enroll-token',
      '123456',
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
    );
    expect(response.headers.get('set-cookie')).toContain(
      'mvo_session=authenticated-session-token',
    );
    const body = await response.json();
    expect(body).toEqual({
      authenticated: true,
      recoveryCodes: Array.from(
        { length: 10 },
        (_, index) => `CODE-${index + 1}`,
      ),
      user: {
        id: 'owner-id',
        username: 'owner',
        role: 'OWNER',
      },
    });
    expect(body).not.toHaveProperty('session');
    expect(JSON.stringify(body)).not.toContain('authenticated-session-token');
  });

  it('does not set a session cookie when TOTP confirmation fails', async () => {
    confirmTwoFactorEnrollment.mockRejectedValueOnce(
      new UnauthorizedException(),
    );

    const response = await fetch(`${baseUrl}/api/auth/pre-auth/2fa/confirm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        preAuthToken: 'enroll-token',
        token: '000000',
      }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('verifies enabled 2FA and sets the authenticated session cookie', async () => {
    const response = await fetch(`${baseUrl}/api/auth/pre-auth/2fa/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        preAuthToken: 'verify-token',
        token: '123456',
      }),
    });

    expect(response.status).toBe(201);
    expect(verifyTwoFactor).toHaveBeenCalledWith(
      'verify-token',
      '123456',
      expect.objectContaining({ ipAddress: '127.0.0.1' }),
    );
    expect(response.headers.get('set-cookie')).toContain(
      'mvo_session=verified-session-token',
    );
    const body = await response.json();
    expect(body).toEqual({
      authenticated: true,
      user: {
        id: 'owner-id',
        username: 'owner',
        role: 'OWNER',
      },
    });
    expect(body).not.toHaveProperty('session');
    expect(JSON.stringify(body)).not.toContain('verified-session-token');
  });

  it('does not set a cookie when enabled 2FA verification fails', async () => {
    verifyTwoFactor.mockRejectedValueOnce(new UnauthorizedException());

    const response = await fetch(`${baseUrl}/api/auth/pre-auth/2fa/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        preAuthToken: 'verify-token',
        token: '000000',
      }),
    });

    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
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

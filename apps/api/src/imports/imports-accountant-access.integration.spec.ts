import {
  ForbiddenException,
  type INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import type { AddressInfo } from 'node:net';
import { AccessControlService } from '../auth/access-control.service';
import type { CurrentUser } from '../auth/auth.types';
import { RolesGuard } from '../auth/roles.guard';
import { WriteAccessGuard } from '../auth/write-access.guard';
import { ImportsService } from './imports.service';

describe('ACCOUNTANT import endpoint access', () => {
  let app: INestApplication;
  let baseUrl: string;
  let actor: CurrentUser;

  const importsService = {
    upload: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    rows: jest.fn(),
    updateMappings: jest.fn(),
    validate: jest.fn(),
    commit: jest.fn(),
    cancel: jest.fn(),
  };

  beforeAll(async () => {
    process.env.API_PORT ??= '3001';
    process.env.CORS_ORIGIN ??= 'http://localhost:3000';
    process.env.DATABASE_URL ??=
      'postgresql://test:test@localhost:5432/mvo_test';

    const { ImportsController } = await import('./imports.controller');
    const moduleRef = await Test.createTestingModule({
      controllers: [ImportsController],
      providers: [
        { provide: ImportsService, useValue: importsService },
        {
          provide: AccessControlService,
          useValue: {
            isReadMethod: (method: string) =>
              ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()),
            deny: jest.fn().mockRejectedValue(
              new ForbiddenException('Доступ заборонено.'),
            ),
          },
        },
        { provide: APP_GUARD, useClass: WriteAccessGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.use((request: { currentUser?: CurrentUser }, _response: unknown, next: () => void) => {
      request.currentUser = actor;
      next();
    });
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    actor = {
      id: '11111111-1111-4111-8111-111111111111',
      username: 'accountant',
      role: UserRole.ACCOUNTANT,
      isActive: true,
      mustChangePassword: false,
      responsiblePersonId: null,
    };
    importsService.upload.mockResolvedValue({ id: 'batch-id' });
    importsService.findAll.mockResolvedValue({ items: [], pagination: {} });
    importsService.findOne.mockResolvedValue({ id: 'batch-id' });
    importsService.rows.mockResolvedValue({ items: [], pagination: {} });
    importsService.updateMappings.mockResolvedValue({ id: 'batch-id' });
    importsService.validate.mockResolvedValue({ id: 'batch-id' });
    importsService.commit.mockResolvedValue({ id: 'batch-id' });
    importsService.cancel.mockResolvedValue({ id: 'batch-id' });
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    ['GET', '/api/imports'],
    ['GET', '/api/imports/batch-id'],
    ['GET', '/api/imports/batch-id/rows'],
    ['PATCH', '/api/imports/batch-id/mappings'],
    ['POST', '/api/imports/batch-id/validate'],
    ['POST', '/api/imports/batch-id/commit'],
    ['POST', '/api/imports/batch-id/cancel'],
  ] as const)('allows ACCOUNTANT %s %s', async (method, path) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: method === 'PATCH' ? { 'content-type': 'application/json' } : undefined,
      body: method === 'PATCH'
        ? JSON.stringify({
            mappings: [{
              counterpartyRaw: 'МВО_0057',
              responsiblePersonId: '22222222-2222-4222-8222-222222222222',
            }],
          })
        : undefined,
    });

    expect(response.status).toBeLessThan(400);
  });

  it('allows ACCOUNTANT to upload a CSV', async () => {
    const form = new FormData();
    form.append('importType', 'INITIAL_BALANCE');
    form.append('file', new Blob(['Контрагент;Кількість'], { type: 'text/csv' }), 'balances.csv');

    const response = await fetch(`${baseUrl}/api/imports/upload`, {
      method: 'POST',
      body: form,
    });

    expect(response.status).toBe(201);
    expect(importsService.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        importType: 'INITIAL_BALANCE',
        audit: expect.objectContaining({ actor }),
      }),
    );
  });

  it('keeps the entire import controller unavailable to MVO', async () => {
    actor = {
      ...actor,
      role: UserRole.MVO,
      responsiblePersonId: '33333333-3333-4333-8333-333333333333',
    };

    const response = await fetch(`${baseUrl}/api/imports`);

    expect(response.status).toBe(403);
    expect(importsService.findAll).not.toHaveBeenCalled();
  });
});

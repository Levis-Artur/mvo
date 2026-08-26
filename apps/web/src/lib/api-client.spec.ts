import { ApiError, apiClient, createApiError } from './api-client';
import { ADMIN_ENTITY_TYPES } from '../features/admin/admin-entity-types';

describe('API client errors', () => {
  it('reads the standardized API error payload', async () => {
    const response = new Response(
      JSON.stringify({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Некоректні вхідні дані',
        details: { messages: ['Поле є обов’язковим'] },
        path: '/api/users',
        requestId: 'request-123',
        timestamp: '2026-07-16T10:00:00.000Z',
      }),
      {
        status: 400,
        headers: { 'content-type': 'application/json' },
      },
    );

    const error = await createApiError(response, 'Помилка запиту');

    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('Некоректні вхідні дані');
    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.requestId).toBe('request-123');
    expect(error.details).toEqual({
      messages: ['Поле є обов’язковим'],
    });
  });

  it('uses a localized fallback and the request header for non-JSON errors', async () => {
    const response = new Response('Bad gateway', {
      status: 502,
      statusText: 'Bad Gateway',
      headers: { 'x-request-id': 'proxy-request-1' },
    });

    const error = await createApiError(response, 'Помилка запиту');

    expect(error.message).toBe('Помилка запиту');
    expect(error.code).toBe('UNKNOWN_ERROR');
    expect(error.requestId).toBe('proxy-request-1');
  });

  it('preserves the duplicate MVO accounting-code error', async () => {
    const response = new Response(
      JSON.stringify({
        statusCode: 409,
        code: 'MVO_ACCOUNTING_CODE_EXISTS',
        message: 'МВО з кодом 0057 уже існує.',
        details: null,
        path: '/api/responsible-persons',
        requestId: 'request-mvo-code',
        timestamp: '2026-07-29T10:00:00.000Z',
      }),
      { status: 409, headers: { 'content-type': 'application/json' } },
    );

    const error = await createApiError(response, 'Помилка запиту');

    expect(error.code).toBe('MVO_ACCOUNTING_CODE_EXISTS');
    expect(error.message).toBe('МВО з кодом 0057 уже існує.');
  });
});

describe('destructive administration URLs', () => {
  const entityTypes = Object.values(ADMIN_ENTITY_TYPES);

  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(entityTypes)(
    'uses the canonical deletion-preview URL for %s',
    async (entityType) => {
      await apiClient.deletionPreview(entityType, 'entity/id');

      expect(fetch).toHaveBeenCalledWith(
        `/api/admin/deletion-preview/${entityType}/entity%2Fid`,
        expect.objectContaining({ credentials: 'include' }),
      );
    },
  );

  it.each(entityTypes)(
    'uses the canonical delete URL and confirmation for %s',
    async (entityType) => {
      await apiClient.deleteAdminEntity(entityType, 'entity-id', false);

      expect(fetch).toHaveBeenCalledWith(
        `/api/admin/${entityType}/entity-id`,
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({
            force: false,
            confirmation: `DELETE ${entityType}:entity-id`,
          }),
        }),
      );
    },
  );

  it('keeps force delete on the same canonical URL', async () => {
    await apiClient.deleteAdminEntity(
      ADMIN_ENTITY_TYPES.responsiblePerson,
      'person-id',
      true,
    );

    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/responsible-persons/person-id',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({
          force: true,
          confirmation: 'DELETE responsible-persons:person-id',
        }),
      }),
    );
  });

  it('uses the canonical rollback URL for imports', async () => {
    await apiClient.rollbackImport('import/id');

    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/imports/import%2Fid/rollback',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('import workflow API URLs', () => {
  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify({ items: [], pagination: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('uses every canonical production import endpoint', async () => {
    await apiClient.imports({ page: 1, limit: 20 });
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/imports?page=1&limit=20',
      expect.objectContaining({ credentials: 'include' }),
    );

    await apiClient.getImportBatch('batch/id');
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/imports/batch/id',
      expect.objectContaining({ credentials: 'include' }),
    );

    await apiClient.getImportRows('batch-id', { page: 1, limit: 20 });
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/imports/batch-id/rows?page=1&limit=20',
      expect.objectContaining({ credentials: 'include' }),
    );

    await apiClient.updateImportMappings('batch-id', { mappings: [] });
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/imports/batch-id/mappings',
      expect.objectContaining({ method: 'PATCH' }),
    );

    await apiClient.validateImport('batch-id');
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/imports/batch-id/validate',
      expect.objectContaining({ method: 'POST' }),
    );

    await apiClient.commitImport('batch-id');
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/imports/batch-id/commit',
      expect.objectContaining({ method: 'POST' }),
    );

    await apiClient.cancelImport('batch-id');
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/imports/batch-id/cancel',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uploads CSV through the canonical endpoint', async () => {
    await apiClient.uploadImport(
      new File(['csv'], 'balances.csv', { type: 'text/csv' }),
      'INITIAL_BALANCE',
    );

    expect(fetch).toHaveBeenLastCalledWith(
      '/api/imports/upload',
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData),
      }),
    );
  });
});

describe('owner/custody API URLs', () => {
  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it('loads the current MVO direct sources from available-to-me', async () => {
    await apiClient.availableStockToMe();
    expect(fetch).toHaveBeenCalledWith(
      '/api/stock/available-to-me',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('loads the selected item movement history from the scoped MVO endpoint', async () => {
    await apiClient.myInventoryItemMovementHistory('item-1', {
      page: 2,
      limit: 25,
    });
    expect(fetch).toHaveBeenCalledWith(
      '/api/inventory-items/item-1/my-movement-history?page=2&limit=25',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('sends scoped search, section, sorting and safe pagination to my-property', async () => {
    await apiClient.myProperty({
      search: 'клавіатура',
      section: 'TRANSFERRED',
      page: 2,
      limit: 100,
      sortBy: 'recipient',
      sortOrder: 'desc',
    });
    expect(fetch).toHaveBeenCalledWith(
      '/api/stock/my-property?search=%D0%BA%D0%BB%D0%B0%D0%B2%D1%96%D0%B0%D1%82%D1%83%D1%80%D0%B0&section=TRANSFERRED&page=2&limit=100&sortBy=recipient&sortOrder=desc',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('downloads authorized CSV as a Blob and reads its filename', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(new Response('\uFEFF"Категорія"\r\n', {
      status: 200,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="mvo-property-002-2026-07-20.csv"',
      },
    }));

    const result = await apiClient.exportMyPropertyCsv({
      search: 'майно',
      section: 'ALL',
    });

    expect(fetch).toHaveBeenLastCalledWith(
      '/api/stock/my-property/export.csv?search=%D0%BC%D0%B0%D0%B9%D0%BD%D0%BE&section=ALL',
      { credentials: 'include' },
    );
    expect(result.filename).toBe('mvo-property-002-2026-07-20.csv');
    expect(await result.blob.text()).toContain('Категорія');
  });

  it('loads transfer targets from the dedicated scoped endpoint', async () => {
    await apiClient.transferTargets({ page: 1, limit: 100, isActive: true });
    expect(fetch).toHaveBeenCalledWith(
      '/api/responsible-persons/transfer-targets?page=1&limit=100&isActive=true',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('loads inventory and responsible-person accounting cards', async () => {
    await apiClient.inventoryItemAccountingCard('item-1', {
      movementPage: 2,
      movementLimit: 100,
      movementType: 'MVO_TRANSFER',
    });
    await apiClient.responsiblePersonAccountingCard('person-1');
    expect(fetch).toHaveBeenNthCalledWith(1, '/api/inventory-items/item-1/accounting-card?movementPage=2&movementLimit=100&movementType=MVO_TRANSFER', expect.any(Object));
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/responsible-persons/person-1/accounting-card', expect.any(Object));
  });

  it('exports all filtered inventory movement history from the dedicated endpoint', async () => {
    jest.mocked(fetch).mockResolvedValueOnce(
      new Response('\uFEFF"Тип операції"\r\n', {
        status: 200,
        headers: {
          'content-disposition':
            'attachment; filename="inventory-history-KB-1.csv"',
        },
      }),
    );

    const result = await apiClient.exportInventoryItemHistoryCsv('item-1', {
      movementType: 'IMPORT',
      documentNumber: 'CSV-7',
    });

    expect(fetch).toHaveBeenLastCalledWith(
      '/api/inventory-items/item-1/accounting-card/movements/export.csv?movementType=IMPORT&documentNumber=CSV-7',
      { credentials: 'include' },
    );
    expect(result.filename).toBe('inventory-history-KB-1.csv');
  });

  it('uses authorized attachment endpoints without serializing the file as JSON', async () => {
    const file = new File(['scan'], 'накладна.pdf', { type: 'application/pdf' });
    await apiClient.uploadStockDocumentAttachment('document-1', file);
    const options = (fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    expect((options.body as FormData).get('file')).toBe(file);
    expect(options.headers).toBeUndefined();
    expect(apiClient.stockDocumentAttachmentDownloadUrl('document-1', 'attachment-1'))
      .toBe('/api/stock-documents/document-1/attachments/attachment-1/download');
  });
});


describe('mandatory 2FA auth API URLs', () => {
  beforeEach(() => {
  jest.spyOn(global, 'fetch').mockImplementation(async () =>
    new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
});

  afterEach(() => jest.restoreAllMocks());

  it('uses the pre-auth password and 2FA endpoints without storing client tokens', async () => {
    await apiClient.login({ username: 'owner', password: 'password-value' });
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/auth/login',
      expect.objectContaining({ method: 'POST' }),
    );

    await apiClient.changePasswordPreAuth({ preAuthToken: 'challenge', newPassword: 'new-password-value' });
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/auth/pre-auth/change-password',
      expect.objectContaining({ method: 'POST' }),
    );

    await apiClient.beginTwoFactorEnrollment('challenge');
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/auth/pre-auth/2fa/enroll',
      expect.objectContaining({ method: 'POST' }),
    );

    await apiClient.confirmTwoFactorEnrollment({ preAuthToken: 'challenge', token: '123456' });
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/auth/pre-auth/2fa/confirm',
      expect.objectContaining({ method: 'POST' }),
    );

    await apiClient.verifyTwoFactor({ preAuthToken: 'challenge', token: '123456' });
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/auth/pre-auth/2fa/verify',
      expect.objectContaining({ method: 'POST' }),
    );

    await apiClient.verifyTwoFactorRecovery({ preAuthToken: 'challenge', recoveryCode: 'ABCD-EFGH-IJKL-MNOP' });
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/auth/pre-auth/2fa/recovery',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('uses the OWNER-only user 2FA reset endpoint', async () => {
    await apiClient.resetUserTwoFactor('user/id');
    expect(fetch).toHaveBeenLastCalledWith(
      '/api/users/user/id/reset-2fa',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });
});

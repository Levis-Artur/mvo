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

import { ApiError, createApiError } from './api-client';

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

  it('uses the response header and fallback values for non-JSON errors', async () => {
    const response = new Response('Bad gateway', {
      status: 502,
      statusText: 'Bad Gateway',
      headers: { 'x-request-id': 'proxy-request-1' },
    });

    const error = await createApiError(response, 'Помилка запиту');

    expect(error.message).toBe('Bad Gateway');
    expect(error.code).toBe('UNKNOWN_ERROR');
    expect(error.requestId).toBe('proxy-request-1');
  });
});

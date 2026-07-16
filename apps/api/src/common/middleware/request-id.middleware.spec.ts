import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../auth/auth.types';
import {
  RequestIdMiddleware,
  REQUEST_ID_PATTERN,
} from './request-id.middleware';

describe('RequestIdMiddleware', () => {
  const middleware = new RequestIdMiddleware();

  function run(header?: string) {
    const request = {
      headers: header ? { 'x-request-id': header } : {},
    } as AuthenticatedRequest;
    const response = {
      setHeader: jest.fn(),
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    middleware.use(request, response, next);
    return { request, response, next };
  }

  it('accepts a valid client request ID', () => {
    const { request, response, next } = run('client-request_123');

    expect(request.requestId).toBe('client-request_123');
    expect(response.setHeader).toHaveBeenCalledWith(
      'X-Request-ID',
      'client-request_123',
    );
    expect(next).toHaveBeenCalled();
  });

  it('generates a UUID for an invalid request ID', () => {
    const { request, response } = run('invalid request id');

    expect(request.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(REQUEST_ID_PATTERN.test(request.requestId!)).toBe(true);
    expect(response.setHeader).toHaveBeenCalledWith(
      'X-Request-ID',
      request.requestId,
    );
  });
});

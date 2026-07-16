import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedRequest } from '../../auth/auth.types';

const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(
    request: AuthenticatedRequest,
    response: Response,
    next: NextFunction,
  ): void {
    const header = request.headers[REQUEST_ID_HEADER];
    const candidate = Array.isArray(header) ? header[0] : header;
    const requestId =
      candidate && REQUEST_ID_PATTERN.test(candidate) ? candidate : randomUUID();

    request.requestId = requestId;
    response.setHeader('X-Request-ID', requestId);
    next();
  }
}

export { REQUEST_ID_PATTERN };

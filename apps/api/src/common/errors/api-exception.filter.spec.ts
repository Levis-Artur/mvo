import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../auth/auth.types';
import { ApiExceptionFilter } from './api-exception.filter';

describe('ApiExceptionFilter', () => {
  const requestId = 'request-123';

  function execute(exception: unknown) {
    const request = {
      originalUrl: '/api/test?value=1',
      requestId,
    } as AuthenticatedRequest;
    const response = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ArgumentsHost;

    new ApiExceptionFilter().catch(exception, host);

    return {
      response,
      body: (response.json as jest.Mock).mock.calls[0][0],
    };
  }

  it('formats ValidationPipe errors', () => {
    const { body } = execute(
      new BadRequestException({
        statusCode: 400,
        message: ['username must be longer than 2 characters'],
        error: 'Bad Request',
      }),
    );

    expect(body).toEqual(
      expect.objectContaining({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'username must be longer than 2 characters',
        details: {
          messages: ['username must be longer than 2 characters'],
        },
        path: '/api/test?value=1',
        requestId,
        timestamp: expect.any(String),
      }),
    );
  });

  it.each([
    [new BadRequestException('Некоректний запит'), 400, 'BAD_REQUEST'],
    [new UnauthorizedException('Невірний логін або пароль.'), 401, 'UNAUTHORIZED'],
    [new ForbiddenException('Доступ заборонено.'), 403, 'FORBIDDEN'],
    [new NotFoundException('Запис не знайдено'), 404, 'NOT_FOUND'],
    [new ConflictException('Запис уже існує'), 409, 'CONFLICT'],
  ])('maps NestJS HTTP exceptions', (exception, statusCode, code) => {
    const { body } = execute(exception);

    expect(body).toEqual(
      expect.objectContaining({
        statusCode,
        code,
        details: null,
        requestId,
      }),
    );
  });

  it.each([
    ['P2002', 409, 'UNIQUE_CONSTRAINT_VIOLATION'],
    ['P2003', 409, 'FOREIGN_KEY_CONSTRAINT_VIOLATION'],
    ['P2025', 404, 'RECORD_NOT_FOUND'],
  ])('maps Prisma %s', (prismaCode, statusCode, code) => {
    const exception = new Prisma.PrismaClientKnownRequestError(
      'Database error with internal details',
      {
        code: prismaCode,
        clientVersion: '6.12.0',
      },
    );
    const { body } = execute(exception);

    expect(body).toEqual(
      expect.objectContaining({
        statusCode,
        code,
        details: null,
        requestId,
      }),
    );
    expect(body.message).not.toContain('internal details');
  });

  it('hides unknown internal error details', () => {
    const { body } = execute(new Error('secret database connection details'));

    expect(body).toEqual(
      expect.objectContaining({
        statusCode: 500,
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Внутрішня помилка сервера',
        details: null,
        requestId,
      }),
    );
    expect(JSON.stringify(body)).not.toContain('secret');
  });
});

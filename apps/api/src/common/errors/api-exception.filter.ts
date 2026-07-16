import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedRequest } from '../../auth/auth.types';
import type {
  ApiErrorCode,
  ApiErrorResponse,
} from './api-error.types';

type ErrorDescriptor = {
  statusCode: number;
  code: ApiErrorCode;
  message: string;
  details: unknown;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<AuthenticatedRequest>();
    const response = context.getResponse<Response>();
    const requestId = request.requestId ?? randomUUID();
    const descriptor = this.describe(exception);

    if (descriptor.statusCode === HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(
        `Unhandled API exception requestId=${requestId} path=${request.originalUrl}`,
        stack,
      );
    }

    const body: ApiErrorResponse = {
      ...descriptor,
      path: request.originalUrl,
      requestId,
      timestamp: new Date().toISOString(),
    };

    response.setHeader('X-Request-ID', requestId);
    response.status(descriptor.statusCode).json(body);
  }

  private describe(exception: unknown): ErrorDescriptor {
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.describePrisma(exception);
    }

    if (exception instanceof BadRequestException) {
      const messages = this.extractMessages(exception);
      const isValidationError =
        messages.length > 1 || this.hasMessageArray(exception);

      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: isValidationError ? 'VALIDATION_ERROR' : 'BAD_REQUEST',
        message: isValidationError
          ? messages.join('; ')
          : (messages[0] ?? 'Некоректний запит'),
        details: isValidationError ? { messages } : null,
      };
    }

    if (exception instanceof UnauthorizedException) {
      return this.httpDescriptor(exception, 'UNAUTHORIZED', 'Не авторизовано');
    }

    if (exception instanceof ForbiddenException) {
      return this.httpDescriptor(exception, 'FORBIDDEN', 'Доступ заборонено');
    }

    if (exception instanceof NotFoundException) {
      return this.httpDescriptor(exception, 'NOT_FOUND', 'Ресурс не знайдено');
    }

    if (exception instanceof ConflictException) {
      return this.httpDescriptor(exception, 'CONFLICT', 'Конфлікт даних');
    }

    if (exception instanceof HttpException) {
      return this.httpDescriptor(exception, 'HTTP_ERROR', 'Помилка HTTP-запиту');
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Внутрішня помилка сервера',
      details: null,
    };
  }

  private describePrisma(
    exception: Prisma.PrismaClientKnownRequestError,
  ): ErrorDescriptor {
    if (exception.code === 'P2002') {
      return {
        statusCode: HttpStatus.CONFLICT,
        code: 'UNIQUE_CONSTRAINT_VIOLATION',
        message: 'Запис із такими унікальними даними вже існує',
        details: null,
      };
    }

    if (exception.code === 'P2003') {
      return {
        statusCode: HttpStatus.CONFLICT,
        code: 'FOREIGN_KEY_CONSTRAINT_VIOLATION',
        message: 'Операція порушує зв’язки між даними',
        details: null,
      };
    }

    if (exception.code === 'P2025') {
      return {
        statusCode: HttpStatus.NOT_FOUND,
        code: 'RECORD_NOT_FOUND',
        message: 'Запис не знайдено',
        details: null,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Внутрішня помилка сервера',
      details: null,
    };
  }

  private httpDescriptor(
    exception: HttpException,
    code: ApiErrorCode,
    fallbackMessage: string,
  ): ErrorDescriptor {
    const extractedMessage = this.extractMessages(exception)[0];
    const defaultMessages = [
      'Bad Request',
      'Unauthorized',
      'Forbidden',
      'Not Found',
      'Conflict',
      'Http Exception',
    ];

    return {
      statusCode: exception.getStatus(),
      code,
      message:
        extractedMessage && !defaultMessages.includes(extractedMessage)
          ? extractedMessage
          : fallbackMessage,
      details: null,
    };
  }

  private extractMessages(exception: HttpException): string[] {
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return [response];
    }

    if (response && typeof response === 'object' && 'message' in response) {
      const message = response.message;
      if (Array.isArray(message)) {
        return message.map(String);
      }
      if (typeof message === 'string') {
        return [message];
      }
    }

    return [exception.message];
  }

  private hasMessageArray(exception: HttpException): boolean {
    const response = exception.getResponse();
    return Boolean(
      response &&
        typeof response === 'object' &&
        'message' in response &&
        Array.isArray(response.message),
    );
  }
}

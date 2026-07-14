import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import type { NextFunction, Response } from 'express';
import { SESSION_COOKIE_NAME } from './auth.constants';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './auth.types';
import { readCookie } from './cookies';

@Injectable()
export class RequireAuthMiddleware implements NestMiddleware {
  constructor(private readonly authService: AuthService) {}

  async use(
    request: AuthenticatedRequest,
    _response: Response,
    next: NextFunction,
  ): Promise<void> {
    const token = readCookie(request, SESSION_COOKIE_NAME);

    if (!token) {
      throw new UnauthorizedException();
    }

    const authenticated = await this.authService.authenticateSession(token);

    if (!authenticated) {
      throw new UnauthorizedException();
    }

    request.currentUser = authenticated.user;
    request.currentSessionId = authenticated.session.id;
    next();
  }
}


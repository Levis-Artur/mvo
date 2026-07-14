import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import type { AuthenticatedRequest } from './auth.types';
import { clearSessionCookie, setSessionCookie } from './cookies';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { getRequestContext } from './request-context';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(
      dto.username,
      dto.password,
      getRequestContext(request),
    );

    setSessionCookie(response, result.token, result.expiresAt);

    return { user: result.user };
  }

  @Post('logout')
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.authService.logout(
      request.currentSessionId,
      request.currentUser,
      getRequestContext(request),
    );
    clearSessionCookie(response);

    return { status: 'ok' };
  }

  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return { user: request.currentUser };
  }

  @Post('change-password')
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @Req() request: AuthenticatedRequest,
  ) {
    if (!request.currentUser) {
      return { user: null };
    }

    const user = await this.authService.changePassword(
      request.currentUser,
      request.currentSessionId,
      dto.oldPassword,
      dto.newPassword,
      getRequestContext(request),
    );

    return { user };
  }

  @Post('logout-all')
  async logoutAll(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (request.currentUser) {
      await this.authService.logoutAll(
        request.currentUser,
        getRequestContext(request),
      );
    }

    clearSessionCookie(response);

    return { status: 'ok' };
  }
}


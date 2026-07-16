import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@prisma/client';
import { AccessControlService } from './access-control.service';
import type { AuthenticatedRequest } from './auth.types';
import { getRequestContext } from './request-context';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessControl: AccessControlService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!roles?.length) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.currentUser;

    if (!user) {
      throw new UnauthorizedException();
    }

    if (roles.includes(user.role)) {
      return true;
    }

    await this.accessControl.deny({
      user,
      path: request.path,
      method: request.method,
      reason: 'ROLE_NOT_ALLOWED',
      ...getRequestContext(request),
    });

    return false;
  }
}

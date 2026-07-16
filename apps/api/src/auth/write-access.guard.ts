import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { AccessControlService } from './access-control.service';
import type { AuthenticatedRequest } from './auth.types';
import { IS_PUBLIC_KEY } from './public.decorator';
import { getRequestContext } from './request-context';

@Injectable()
export class WriteAccessGuard implements CanActivate {
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

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.currentUser;

    if (!user) {
      throw new UnauthorizedException();
    }

    if (this.accessControl.isReadMethod(request.method)) {
      return true;
    }

    if (request.path.startsWith('/auth/')) {
      return true;
    }

    if (user.role === UserRole.AUDITOR) {
      await this.accessControl.deny({
        user,
        path: request.path,
        method: request.method,
        reason: 'AUDITOR_READ_ONLY',
        ...getRequestContext(request),
      });
    }

    return true;
  }
}

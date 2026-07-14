import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AccessControlService } from './access-control.service';
import type { AuthenticatedRequest } from './auth.types';
import { getRequestContext } from './request-context';

@Injectable()
export class WriteAccessGuard implements CanActivate {
  constructor(private readonly accessControl: AccessControlService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.currentUser;

    if (
      (request.method === 'GET' && request.path === '/health') ||
      (request.method === 'POST' && request.path === '/auth/login')
    ) {
      return true;
    }

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

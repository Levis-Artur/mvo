import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, CurrentUser } from './auth.types';

export const CurrentUserParam = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUser | undefined => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.currentUser;
  },
);


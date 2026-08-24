import type { Request } from 'express';
import type { UserRole } from '@prisma/client';

export type CurrentUserAccessScope = {
  managementId: string | null;
  serviceCode: string | null;
};

export type CurrentUser = {
  id: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  responsiblePersonId: string | null;
  accessScopes?: readonly CurrentUserAccessScope[];
};

export type AuthenticatedRequest = Request & {
  currentUser?: CurrentUser;
  currentSessionId?: string;
  requestId?: string;
};

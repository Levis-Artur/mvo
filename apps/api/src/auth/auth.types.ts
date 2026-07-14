import type { Request } from 'express';
import type { UserRole } from '@prisma/client';

export type CurrentUser = {
  id: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  mustChangePassword: boolean;
  responsiblePersonId: string | null;
};

export type AuthenticatedRequest = Request & {
  currentUser?: CurrentUser;
  currentSessionId?: string;
};


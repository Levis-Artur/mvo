import type { UserRole } from '../../lib/types';

export const displayRoleLabels: Record<UserRole, string> = {
  OWNER: 'Власник',
  AUDITOR: 'Аудитор',
  DPP_ADMIN: 'Адміністратор ДПП',
  MVO: 'Матеріально відповідальна особа',
};

export function displayRoleLabel(role: UserRole) { return displayRoleLabels[role]; }

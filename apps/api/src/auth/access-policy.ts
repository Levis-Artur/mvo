import { UserRole } from '@prisma/client';

export type AccessCapability =
  | 'REFERENCE_DATA_READ'
  | 'REFERENCE_DATA_WRITE'
  | 'STOCK_READ'
  | 'IMPORT_READ'
  | 'IMPORT_WRITE'
  | 'STOCK_DOCUMENT_READ'
  | 'STOCK_DOCUMENT_WRITE'
  | 'USER_ADMINISTRATION'
  | 'OWNER_DESTRUCTIVE_ADMINISTRATION'
  | 'MVO_SCOPED_ACCESS';

export const roleCapabilities = {
  [UserRole.OWNER]: [
    'REFERENCE_DATA_READ',
    'REFERENCE_DATA_WRITE',
    'STOCK_READ',
    'IMPORT_READ',
    'IMPORT_WRITE',
    'STOCK_DOCUMENT_READ',
    'STOCK_DOCUMENT_WRITE',
    'USER_ADMINISTRATION',
    'OWNER_DESTRUCTIVE_ADMINISTRATION',
  ],
  [UserRole.DPP_ADMIN]: [
    'REFERENCE_DATA_READ',
    'REFERENCE_DATA_WRITE',
    'STOCK_READ',
    'IMPORT_READ',
    'IMPORT_WRITE',
    'STOCK_DOCUMENT_READ',
    'STOCK_DOCUMENT_WRITE',
    'USER_ADMINISTRATION',
  ],
  [UserRole.ACCOUNTANT]: [
    'REFERENCE_DATA_READ',
    'STOCK_READ',
    'IMPORT_READ',
    'IMPORT_WRITE',
    'STOCK_DOCUMENT_READ',
  ],
  [UserRole.AUDITOR]: [
    'REFERENCE_DATA_READ',
    'STOCK_READ',
    'IMPORT_READ',
    'STOCK_DOCUMENT_READ',
  ],
  [UserRole.MVO]: [
    'REFERENCE_DATA_READ',
    'STOCK_READ',
    'STOCK_DOCUMENT_READ',
    'STOCK_DOCUMENT_WRITE',
    'MVO_SCOPED_ACCESS',
  ],
} satisfies Record<UserRole, readonly AccessCapability[]>;

export const REFERENCE_DATA_READ_ROLES = [
  UserRole.OWNER,
  UserRole.DPP_ADMIN,
  UserRole.ACCOUNTANT,
  UserRole.AUDITOR,
];

export const REFERENCE_DATA_WRITE_ROLES = [
  UserRole.OWNER,
  UserRole.DPP_ADMIN,
];

export const STOCK_READ_ROLES = REFERENCE_DATA_READ_ROLES;

export const ACCOUNTING_CARD_READ_ROLES = [
  UserRole.OWNER,
  UserRole.DPP_ADMIN,
  UserRole.ACCOUNTANT,
  UserRole.AUDITOR,
  UserRole.MVO,
];

export const IMPORT_READ_ROLES = [
  UserRole.OWNER,
  UserRole.DPP_ADMIN,
  UserRole.ACCOUNTANT,
  UserRole.AUDITOR,
];

export const IMPORT_WRITE_ROLES = [
  UserRole.OWNER,
  UserRole.DPP_ADMIN,
  UserRole.ACCOUNTANT,
];

export const STOCK_DOCUMENT_READ_ROLES = REFERENCE_DATA_READ_ROLES;

export const STOCK_DOCUMENT_WRITE_ROLES = [
  UserRole.OWNER,
  UserRole.DPP_ADMIN,
  UserRole.MVO,
];

export function hasCapability(
  role: UserRole,
  capability: AccessCapability,
): boolean {
  const capabilities: readonly AccessCapability[] = roleCapabilities[role];
  return capabilities.includes(capability);
}

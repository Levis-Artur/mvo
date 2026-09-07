import { UserRole } from '@prisma/client';

export type AccessCapability =
  | 'REFERENCE_DATA_READ'
  | 'REFERENCE_DATA_WRITE'
  | 'STOCK_READ'
  | 'IMPORT_READ'
  | 'IMPORT_WRITE'
  | 'STOCK_DOCUMENT_READ'
  | 'STOCK_DOCUMENT_WRITE'
  | 'ACCOUNTING_TRANSFER_READ'
  | 'ACCOUNTING_WORKSPACE_READ'
  | 'USER_ADMINISTRATION'
  | 'OWNER_DESTRUCTIVE_ADMINISTRATION'
  | 'MVO_SCOPED_ACCESS'
  | 'ORG_SCOPED_ACCESS';

export const roleCapabilities = {
  [UserRole.OWNER]: [
    'REFERENCE_DATA_READ',
    'REFERENCE_DATA_WRITE',
    'STOCK_READ',
    'IMPORT_READ',
    'IMPORT_WRITE',
    'STOCK_DOCUMENT_READ',
    'STOCK_DOCUMENT_WRITE',
    'ACCOUNTING_TRANSFER_READ',
    'ACCOUNTING_WORKSPACE_READ',
    'USER_ADMINISTRATION',
    'OWNER_DESTRUCTIVE_ADMINISTRATION',
  ],
  [UserRole.ACCOUNTANT]: [
    'IMPORT_READ',
    'IMPORT_WRITE',
    'ACCOUNTING_WORKSPACE_READ',
  ],
  [UserRole.MVO]: [
    'STOCK_READ',
    'STOCK_DOCUMENT_READ',
    'STOCK_DOCUMENT_WRITE',
    'MVO_SCOPED_ACCESS',
  ],
  [UserRole.ORG_MANAGER]: [
    'REFERENCE_DATA_READ',
    'STOCK_READ',
    'STOCK_DOCUMENT_READ',
    'ORG_SCOPED_ACCESS',
  ],
} satisfies Record<UserRole, readonly AccessCapability[]>;

export const REFERENCE_DATA_READ_ROLES = [
  UserRole.OWNER,
];

export const REFERENCE_DATA_WRITE_ROLES = [
  UserRole.OWNER,
];

export const RESPONSIBLE_PERSON_READ_ROLES = [
  ...REFERENCE_DATA_READ_ROLES,
  UserRole.MVO,
  UserRole.ORG_MANAGER,
];

export const STOCK_BALANCE_READ_ROLES = [
  ...REFERENCE_DATA_READ_ROLES,
  UserRole.MVO,
  UserRole.ORG_MANAGER,
];

export const STOCK_READ_ROLES = [
  ...REFERENCE_DATA_READ_ROLES,
  UserRole.MVO,
];

export const TRANSACTION_READ_ROLES = [
  UserRole.OWNER,
];

export const ACCOUNTING_CARD_READ_ROLES = [
  UserRole.OWNER,
  UserRole.MVO,
];

export const INVENTORY_ITEM_ACCOUNTING_CARD_READ_ROLES = [
  UserRole.OWNER,
];

export const IMPORT_READ_ROLES = [
  UserRole.OWNER,
  UserRole.ACCOUNTANT,
];

export const IMPORT_WRITE_ROLES = [
  UserRole.OWNER,
  UserRole.ACCOUNTANT,
];

export const STOCK_DOCUMENT_READ_ROLES = [
  ...REFERENCE_DATA_READ_ROLES,
  UserRole.MVO,
];

export const STOCK_DOCUMENT_WRITE_ROLES = [
  UserRole.OWNER,
  UserRole.MVO,
];

export const ACCOUNTING_TRANSFER_READ_ROLES = [
  UserRole.OWNER,
];

export const ACCOUNTING_TRANSFER_EXPORT_ROLES = [
  UserRole.OWNER,
];

export const ACCOUNTING_ANALYTICS_READ_ROLES = [
  UserRole.OWNER,
];

export const TRANSFER_TARGET_READ_ROLES = [
  UserRole.OWNER,
  UserRole.MVO,
];

export function hasCapability(
  role: UserRole,
  capability: AccessCapability,
): boolean {
  const capabilities: readonly AccessCapability[] = roleCapabilities[role];
  return capabilities.includes(capability);
}

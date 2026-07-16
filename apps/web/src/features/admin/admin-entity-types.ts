import type { AdminEntityType } from '../../lib/types';

export const ADMIN_ENTITY_TYPES = {
  import: 'imports',
  responsiblePerson: 'responsible-persons',
  management: 'managements',
  service: 'services',
  unit: 'units',
  user: 'users',
  inventoryItem: 'inventory-items',
} as const satisfies Record<string, AdminEntityType>;

export type AdminEntity = keyof typeof ADMIN_ENTITY_TYPES;

export function getAdminEntityType(entity: AdminEntity): AdminEntityType {
  return ADMIN_ENTITY_TYPES[entity];
}

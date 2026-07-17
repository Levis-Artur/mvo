import { ApiError } from '../../lib/api-client';
import type { AdminEntityType, DeletionPreview, UserRole } from '../../lib/types';

export const DESTRUCTIVE_MODE_DISABLED_MESSAGE =
  'Режим видалення тестових даних вимкнений на сервері';

export function canShowDestructiveActions(role?: UserRole) { return role === 'OWNER'; }
export function requiredConfirmation(preview: DeletionPreview, force: boolean) {
  return force ? preview.displayName : 'ВИДАЛИТИ';
}
export function isConfirmationValid(preview: DeletionPreview, force: boolean, value: string) {
  return value === requiredConfirmation(preview, force);
}
export function destructiveErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 403 && /destructive|режим/i.test(error.message)) {
    return DESTRUCTIVE_MODE_DISABLED_MESSAGE;
  }
  return error instanceof Error ? error.message : 'Не вдалося виконати операцію.';
}
export async function executeDestructiveAction(options: {
  preview: DeletionPreview;
  force: boolean;
  confirmation: string;
  remove: (entityType: AdminEntityType, id: string, force: boolean) => Promise<unknown>;
  onSuccess: () => Promise<void> | void;
}) {
  if (!isConfirmationValid(options.preview, options.force, options.confirmation)) return false;
  await options.remove(options.preview.entityType, options.preview.entityId, options.force);
  await options.onSuccess();
  return true;
}

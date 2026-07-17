import { ApiError } from '../../lib/api-client';

export const RESET_CONFIRMATION = 'DELETE TEST DATA';
export type DestructiveModeState = 'checking' | 'enabled' | 'disabled' | 'error';

export function isResetConfirmationValid(value: string) {
  return value === RESET_CONFIRMATION;
}

export async function readDestructiveMode(probe: () => Promise<unknown>): Promise<DestructiveModeState> {
  try { await probe(); return 'enabled'; }
  catch (error) { return error instanceof ApiError && error.status === 403 ? 'disabled' : 'error'; }
}

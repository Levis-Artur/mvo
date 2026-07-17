import { ApiError } from '../../lib/api-client';
import { isResetConfirmationValid, readDestructiveMode } from './administration-model';

describe('administration presentation model', () => {
  it('requires the exact reset confirmation', () => {
    expect(isResetConfirmationValid('DELETE TEST DATA')).toBe(true);
    expect(isResetConfirmationValid('delete test data')).toBe(false);
    expect(isResetConfirmationValid('DELETE TEST DATA ')).toBe(false);
  });

  it('reads destructive mode only from the backend response', async () => {
    expect(await readDestructiveMode(() => Promise.resolve({ canDelete: false }))).toBe('enabled');
    expect(await readDestructiveMode(() => Promise.reject(new ApiError('disabled', 403)))).toBe('disabled');
  });
});

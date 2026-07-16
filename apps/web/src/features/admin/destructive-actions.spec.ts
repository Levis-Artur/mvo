import { ApiError } from '../../lib/api-client';
import type { DeletionPreview } from '../../lib/types';
import {
  DESTRUCTIVE_MODE_DISABLED_MESSAGE,
  canShowDestructiveActions,
  destructiveErrorMessage,
  executeDestructiveAction,
  isConfirmationValid,
} from './destructive-actions';

const preview: DeletionPreview = {
  entityType: 'user',
  entityId: 'user-1',
  displayName: 'test-owner',
  canDelete: true,
  blockers: [],
  dependencies: [{ type: 'sessions', count: 2, action: 'DELETE' }],
};

describe('OWNER destructive administration', () => {
  it('hides delete actions from MVO and shows them to OWNER', () => {
    expect(canShowDestructiveActions('MVO')).toBe(false);
    expect(canShowDestructiveActions('OWNER')).toBe(true);
  });

  it('preserves dependencies for the confirmation modal', () => {
    expect(preview.dependencies).toEqual([
      { type: 'sessions', count: 2, action: 'DELETE' },
    ]);
  });

  it('does not send a request without the exact confirmation', async () => {
    const remove = jest.fn();
    const result = await executeDestructiveAction({
      preview,
      force: false,
      confirmation: 'delete',
      remove,
      onSuccess: jest.fn(),
    });
    expect(result).toBe(false);
    expect(remove).not.toHaveBeenCalled();
    expect(isConfirmationValid(preview, true, 'test-owner')).toBe(true);
  });

  it('refreshes the table after success', async () => {
    const reload = jest.fn();
    await executeDestructiveAction({
      preview,
      force: false,
      confirmation: 'ВИДАЛИТИ',
      remove: jest.fn().mockResolvedValue({ success: true }),
      onSuccess: reload,
    });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('shows the server-disabled message and regular API errors', () => {
    expect(
      destructiveErrorMessage(
        new ApiError('Destructive administration disabled', 403, 'FORBIDDEN'),
      ),
    ).toBe(DESTRUCTIVE_MODE_DISABLED_MESSAGE);
    expect(
      destructiveErrorMessage(new ApiError('Залежність блокує видалення', 409)),
    ).toBe('Залежність блокує видалення');
  });
});

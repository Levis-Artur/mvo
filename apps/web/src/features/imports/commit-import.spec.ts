import type { ImportBatch } from '../../lib/types';
import { executeImportCommit } from './commit-import';

const batch = {
  id: 'batch',
  status: 'COMPLETED',
} as ImportBatch;

describe('executeImportCommit', () => {
  it('sets loading and refreshes data after success', async () => {
    const loading: boolean[] = [];
    const onSuccess = jest.fn();

    await expect(
      executeImportCommit({
        commit: jest.fn().mockResolvedValue(batch),
        setLoading: (value) => loading.push(value),
        setError: jest.fn(),
        getErrorMessage: (error) => String(error),
        onSuccess,
      }),
    ).resolves.toBe(true);

    expect(loading).toEqual([true, false]);
    expect(onSuccess).toHaveBeenCalledWith(batch);
  });

  it('shows the exact backend error and does not run success handling', async () => {
    const errors: string[] = [];
    const onSuccess = jest.fn();

    await expect(
      executeImportCommit({
        commit: jest
          .fn()
          .mockRejectedValue(new Error('Не всі рядки мають кількість')),
        setLoading: jest.fn(),
        setError: (message) => errors.push(message),
        getErrorMessage: (error) => (error as Error).message,
        onSuccess,
      }),
    ).resolves.toBe(false);

    expect(errors).toEqual(['', 'Не всі рядки мають кількість']);
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('always clears loading after an error', async () => {
    const loading: boolean[] = [];

    await executeImportCommit({
      commit: jest.fn().mockRejectedValue(new Error('failure')),
      setLoading: (value) => loading.push(value),
      setError: jest.fn(),
      getErrorMessage: (error) => (error as Error).message,
      onSuccess: jest.fn(),
    });

    expect(loading).toEqual([true, false]);
  });
});

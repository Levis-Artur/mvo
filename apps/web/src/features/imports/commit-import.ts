import type { ImportBatch } from '../../lib/types';

export async function executeImportCommit(options: {
  commit: () => Promise<ImportBatch>;
  setLoading: (loading: boolean) => void;
  setError: (message: string) => void;
  getErrorMessage: (error: unknown) => string;
  onSuccess: (batch: ImportBatch) => Promise<void> | void;
}) {
  options.setLoading(true);
  options.setError('');
  try {
    const batch = await options.commit();
    await options.onSuccess(batch);
    return true;
  } catch (error) {
    options.setError(options.getErrorMessage(error));
    return false;
  } finally {
    options.setLoading(false);
  }
}

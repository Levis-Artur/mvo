import type { ImportBatch, ImportRowStatus, ImportStatus, UserRole } from '@/lib/types';
import type { StatusTone } from '@/components/ui';

const importStatuses: Record<ImportStatus, { label: string; tone: StatusTone }> = {
  UPLOADED: { label: 'Завантажено', tone: 'info' },
  VALIDATED: { label: 'Перевірено', tone: 'success' },
  COMPLETED: { label: 'Проведено', tone: 'success' },
  PARTIALLY_COMPLETED: { label: 'Частково проведено', tone: 'warning' },
  FAILED: { label: 'Помилка', tone: 'danger' },
  CANCELLED: { label: 'Скасовано', tone: 'neutral' },
  ROLLED_BACK: { label: 'Відкочено', tone: 'warning' },
};

const rowStatuses: Record<ImportRowStatus, { label: string; tone: StatusTone }> = {
  VALID: { label: 'Готово', tone: 'success' },
  WARNING: { label: 'Попередження', tone: 'warning' },
  ERROR: { label: 'Помилка', tone: 'danger' },
  SKIPPED: { label: 'Пропущено', tone: 'neutral' },
  IMPORTED: { label: 'Проведено', tone: 'info' },
};

export const importStatusPresentation = (status: ImportStatus) => importStatuses[status];
export const importRowStatusPresentation = (status: ImportRowStatus) => rowStatuses[status];

export function importSummary(batch: ImportBatch) {
  const valid = batch.preview?.validRows ?? batch.validRows;
  const warnings = batch.preview?.warningRows ?? batch.warningRows;
  return {
    total: batch.totalRows,
    valid,
    warnings,
    errors: batch.preview?.errorRows ?? batch.errorRows,
    skipped: batch.preview?.skippedRows ?? batch.skippedRows,
    imported: batch.preview?.importedRows ?? batch.importedRows,
    newItems: batch.preview?.newItems ?? 0,
    updatedItems: batch.preview?.updatedItems ?? 0,
    operations: valid + warnings,
  };
}

export function importRoleAccess(role?: UserRole) {
  return {
    canWrite: role === 'OWNER' || role === 'DPP_ADMIN' || role === 'ACCOUNTANT',
    canDelete: role === 'OWNER',
  };
}

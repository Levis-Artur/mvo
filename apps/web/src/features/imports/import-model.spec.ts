import type { ImportBatch } from '@/lib/types';
import {
  importRoleAccess,
  importRowStatusPresentation,
  importStatusPresentation,
  importSummary,
} from './import-model';

const batch: ImportBatch = {
  id: 'import-1', type: 'INITIAL_BALANCE', status: 'VALIDATED',
  originalFilename: 'залишки.csv', fileHash: 'hash', fileSize: 100,
  encoding: 'windows-1251', delimiter: 'tab', totalRows: 9,
  validRows: 2, warningRows: 3, errorRows: 1, skippedRows: 3,
  importedRows: 0, createdAt: '2026-01-01T00:00:00.000Z', completedAt: null,
  preview: { validRows: 2, warningRows: 3, errorRows: 1, skippedRows: 3,
    importedRows: 0, newItems: 2, matchedPersons: 1, missingPersons: 0 },
};

describe('import presentation model', () => {
  it('maps every import status to a visible label', () => {
    expect(importStatusPresentation('UPLOADED').label).toBe('Завантажено');
    expect(importStatusPresentation('VALIDATED').label).toBe('Перевірено');
    expect(importStatusPresentation('COMPLETED').label).toBe('Проведено');
    expect(importStatusPresentation('PARTIALLY_COMPLETED').tone).toBe('warning');
    expect(importStatusPresentation('FAILED').tone).toBe('danger');
    expect(importStatusPresentation('CANCELLED').label).toBe('Скасовано');
    expect(importStatusPresentation('ROLLED_BACK').label).toBe('Відкочено');
  });

  it('never presents SKIPPED as WARNING', () => {
    expect(importRowStatusPresentation('SKIPPED')).toEqual({ label: 'SKIPPED', tone: 'neutral' });
    expect(importRowStatusPresentation('SKIPPED')).not.toEqual(importRowStatusPresentation('WARNING'));
  });

  it('counts only VALID and WARNING rows as commit operations', () => {
    expect(importSummary(batch)).toMatchObject({ operations: 5, skipped: 3, errors: 1 });
  });

  it('limits destructive import actions to OWNER', () => {
    expect(importRoleAccess('OWNER').canDelete).toBe(true);
    expect(importRoleAccess('DPP_ADMIN').canDelete).toBe(false);
    expect(importRoleAccess('MVO').canDelete).toBe(false);
  });

  it('дозволяє ACCOUNTANT працювати з імпортами без destructive actions', () => {
    expect(importRoleAccess('ACCOUNTANT')).toEqual({ canWrite: true, canDelete: false });
  });
});

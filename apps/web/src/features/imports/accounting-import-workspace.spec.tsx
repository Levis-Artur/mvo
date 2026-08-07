/** @jest-environment jsdom */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { can } from '@/lib/authz';
import type { AuthUser, ImportBatch } from '@/lib/types';
import { ImportUploadModal } from './import-upload-modal';

const mockUploadImport = jest.fn();
const mockValidateImport = jest.fn();

jest.mock('./imports.service', () => ({
  importsService: {
    uploadImport: (...args: unknown[]) => mockUploadImport(...args),
    validateImport: (...args: unknown[]) => mockValidateImport(...args),
  },
}));

const batch = {
  id: 'batch-id',
  type: 'INITIAL_BALANCE',
  status: 'UPLOADED',
  originalFilename: 'balances.csv',
} as ImportBatch;

const user = (role: AuthUser['role']) => ({ role }) as AuthUser;

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('Accounting import workspace', () => {
  it('uploads and analyzes through the existing production importer without committing', async () => {
    const analyzed = { ...batch, status: 'VALIDATED' } as ImportBatch;
    mockUploadImport.mockResolvedValue(batch);
    mockValidateImport.mockResolvedValue(analyzed);
    const onSaved = jest.fn();
    const interaction = userEvent.setup();
    const view = render(
      <ImportUploadModal onClose={jest.fn()} onSaved={onSaved} />,
    );
    const input = view.container.querySelector<HTMLInputElement>('input[type="file"]');
    expect(input).toBeTruthy();

    await interaction.upload(input!, new File(['csv'], 'balances.csv', { type: 'text/csv' }));
    fireEvent.submit(view.container.querySelector('form')!);

    await waitFor(() => expect(mockUploadImport).toHaveBeenCalledTimes(1));
    expect(mockValidateImport).toHaveBeenCalledWith('batch-id');
    expect(onSaved).toHaveBeenCalledWith(analyzed);
  });

  it('reuses one import workspace with accounting headings, preview and history', () => {
    const workspace = readFileSync(
      join(__dirname, '../accounting/accounting-workspace-view.tsx'),
      'utf8',
    );
    const view = readFileSync(join(__dirname, 'imports-view.tsx'), 'utf8');
    const detail = readFileSync(join(__dirname, 'import-detail-view.tsx'), 'utf8');
    const rows = readFileSync(join(__dirname, 'import-rows-table.tsx'), 'utf8');
    const history = readFileSync(join(__dirname, 'imports-table.tsx'), 'utf8');

    expect(workspace).toContain('<ImportsView accountingWorkspace embedded />');
    expect(view).toContain('Імпорт бухгалтерських даних');
    expect(view).toContain('Історія імпортів');
    expect(detail).toContain('Завантажте CSV-файл оборотної відомості');
    expect(detail).toContain('<option value="VALID">Готові</option>');
    expect(detail).toContain('<option value="ERROR">З помилками</option>');
    for (const label of [
      '№ рядка', 'Контрагент', 'Код МВО', 'МВО у системі',
      'Код номенклатури', 'Назва', 'Кількість', 'Статус', 'Помилка',
    ]) expect(rows).toContain(label);
    expect(history).toContain('Хто завантажив');
    expect(history).toContain('batch.uploadedByUser?.username');
  });

  it('allows OWNER and ACCOUNTANT while keeping MVO out of imports', () => {
    expect(can(user('OWNER'), 'write', 'imports')).toBe(true);
    expect(can(user('ACCOUNTANT'), 'write', 'imports')).toBe(true);
    expect(can(user('MVO'), 'read', 'imports')).toBe(false);
    expect(can(user('MVO'), 'write', 'imports')).toBe(false);
  });
});

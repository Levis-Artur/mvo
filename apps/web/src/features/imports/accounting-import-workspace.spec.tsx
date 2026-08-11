/** @jest-environment jsdom */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { can } from '@/lib/authz';
import type { AuthUser, ImportBatch } from '@/lib/types';
import { ImportUploadModal } from './import-upload-modal';
import { AccountingImportsHome } from './accounting-imports-home';
import { ImportDetailView } from './import-detail-view';

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
  status: 'COMPLETED',
  originalFilename: 'залишки_серпень.csv',
  fileHash: 'hash',
  fileSize: 100,
  encoding: 'utf-8',
  delimiter: ';',
  totalRows: 155,
  validRows: 150,
  warningRows: 5,
  errorRows: 0,
  skippedRows: 0,
  importedRows: 155,
  createdAt: '2026-08-10T11:35:00.000Z',
  completedAt: '2026-08-10T11:40:00.000Z',
  uploadedByUser: { id: 'accountant-id', username: 'accountant' },
  preview: {
    validRows: 150,
    warningRows: 5,
    errorRows: 0,
    skippedRows: 0,
    importedRows: 155,
    newItems: 10,
    updatedItems: 41,
    matchedPersons: 2,
    missingPersons: 0,
  },
} as ImportBatch;

const user = (role: AuthUser['role']) => ({ role }) as AuthUser;

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('Accounting import workspace', () => {
  it('uploads and analyzes through the existing production importer without committing', async () => {
    const uploaded = { ...batch, status: 'UPLOADED' } as ImportBatch;
    const analyzed = { ...batch, status: 'VALIDATED' } as ImportBatch;
    mockUploadImport.mockResolvedValue(uploaded);
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

  it('shows upload as the primary action, the latest import and compact history', () => {
    render(
      <AccountingImportsHome
        canUpload
        error=""
        imports={[batch]}
        latestImport={batch}
        loading={false}
        pagination={{ page: 1, limit: 20, total: 1, totalPages: 1 }}
        onLimitChange={jest.fn()}
        onOpen={jest.fn()}
        onPage={jest.fn()}
        onUpload={jest.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Бухгалтерія' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Завантажити відомість/ })).toBeTruthy();
    expect(screen.getByText('Останнє завантаження')).toBeTruthy();
    expect(screen.getByText('Історія завантажень')).toBeTruthy();
    expect(screen.getAllByText('залишки_серпень.csv')).toHaveLength(2);
    expect(screen.getByText('155 рядків')).toBeTruthy();
    expect(screen.getByText('51')).toBeTruthy();
  });

  it('reuses one importer with a simplified accounting home, preview and details', () => {
    const workspace = readFileSync(
      join(__dirname, '../accounting/accounting-workspace-view.tsx'),
      'utf8',
    );
    const view = readFileSync(join(__dirname, 'imports-view.tsx'), 'utf8');
    const detail = readFileSync(join(__dirname, 'import-detail-view.tsx'), 'utf8');
    const rows = readFileSync(join(__dirname, 'import-rows-table.tsx'), 'utf8');
    const history = readFileSync(join(__dirname, 'imports-table.tsx'), 'utf8');

    const home = readFileSync(join(__dirname, 'accounting-imports-home.tsx'), 'utf8');

    expect(workspace).toContain('<ImportsView accountingWorkspace embedded />');
    expect(view).toContain('<AccountingImportsHome');
    expect(home).toContain('Завантажити відомість');
    expect(home).toContain('Останнє завантаження');
    expect(home).toContain('Історія завантажень');
    expect(detail).toContain('Перевірка відомості');
    expect(detail).toContain('Файл містить помилки');
    expect(detail).toContain('<option value="VALID">Готові</option>');
    expect(detail).toContain('<option value="ERROR">З помилками</option>');
    for (const label of [
      '№ рядка', 'Контрагент', 'Код МВО', 'МВО у системі',
      'Код номенклатури', 'Назва', 'Кількість', 'Статус', 'Помилка',
    ]) expect(rows).toContain(label);
    expect(history).toContain("{ label: 'Автор' }");
    expect(history).toContain('batch.uploadedByUser?.username');
    expect(view).toContain('!accountingWorkspace');
  });

  it('allows OWNER and ACCOUNTANT while keeping MVO out of imports', () => {
    expect(can(user('OWNER'), 'write', 'imports')).toBe(true);
    expect(can(user('ACCOUNTANT'), 'write', 'imports')).toBe(true);
    expect(can(user('MVO'), 'read', 'imports')).toBe(false);
    expect(can(user('MVO'), 'write', 'imports')).toBe(false);
  });

  it('keeps validate, commit and cancel available in the ACCOUNTANT workflow', async () => {
    const onValidate = jest.fn();
    const onCommit = jest.fn();
    const onCancel = jest.fn();
    const interaction = userEvent.setup();

    render(
      <ImportDetailView
        accountingWorkspace
        actionLoading={false}
        batch={{ ...batch, status: 'VALIDATED' }}
        canCommit
        canWrite
        detailLoading={false}
        error=""
        filters={{ search: '', status: '', page: 1, limit: 20 }}
        isOwner={false}
        mappings={{}}
        missingCounterparties={[]}
        pagination={{ page: 1, limit: 20, total: 0, totalPages: 0 }}
        persons={[]}
        rows={[]}
        rowsLoading={false}
        setFilters={jest.fn()}
        setMappings={jest.fn()}
        onApplyFilters={jest.fn()}
        onBack={jest.fn()}
        onCancel={onCancel}
        onCommit={onCommit}
        onDelete={jest.fn()}
        onRollback={jest.fn()}
        onSaveMappings={jest.fn()}
        onValidate={onValidate}
      />,
    );

    await interaction.click(screen.getByRole('button', { name: 'Перевірити повторно' }));
    await interaction.click(screen.getByRole('button', { name: 'Провести імпорт' }));
    await interaction.click(screen.getByRole('button', { name: 'Скасувати' }));

    expect(onValidate).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('uses responsive cards for mobile import history without a page-level horizontal scroller', () => {
    const history = readFileSync(join(__dirname, 'imports-table.tsx'), 'utf8');
    const styles = readFileSync(join(__dirname, '../../styles/responsive.css'), 'utf8');
    expect(history).toContain('responsiveMode="cards-wide"');
    expect(styles).toContain('.accounting-imports__primary-action { width: 100%; }');
  });
});

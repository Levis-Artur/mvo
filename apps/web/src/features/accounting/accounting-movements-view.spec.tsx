/** @jest-environment jsdom */

import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  AccountingMovementDetails,
  AccountingMovementRow,
} from '@/lib/types';
import { AccountingMovementsView } from './accounting-movements-view';

const mockList = jest.fn();
const mockDetails = jest.fn();
const mockDocumentDetails = jest.fn();
const mockExport = jest.fn();
const mockPersons = jest.fn();
const mockDownload = jest.fn();

jest.mock('./accounting-movements.service', () => ({
  accountingMovementsService: {
    list: (...args: unknown[]) => mockList(...args),
    details: (...args: unknown[]) => mockDetails(...args),
    documentDetails: (...args: unknown[]) => mockDocumentDetails(...args),
    exportCsv: (...args: unknown[]) => mockExport(...args),
    persons: (...args: unknown[]) => mockPersons(...args),
    attachmentDownloadUrl: (documentId: string, attachmentId: string) =>
      `/api/stock-documents/${documentId}/attachments/${attachmentId}/download`,
  },
}));

jest.mock('@/features/responsible-persons/my-stock-model', () => ({
  downloadFileInBrowser: (...args: unknown[]) => mockDownload(...args),
}));

const baseRow: AccountingMovementRow = {
  id: 'movement-1',
  occurredAt: '2026-08-07T10:00:00.000Z',
  operationType: 'IMPORT',
  operationLabel: 'Надходження',
  documentLabel: 'оборотна-відомість.csv',
  documentId: null,
  responsiblePerson: {
    id: 'person-1',
    personnelNumber: '57',
    externalAccountingCode: '0057',
    fullName: 'Жигульський Андрій Васильович',
  },
  inventoryItem: {
    id: 'item-1',
    externalCode: 'KB-1',
    name: 'Клавіатура',
    unitOfMeasure: 'шт.',
  },
  quantity: '+10',
  direction: 'Бухгалтерія → 0057 — Жигульський Андрій Васильович',
  transferredTo: null,
  issuedTo: null,
  relatedDocument: null,
  hasAttachment: false,
  status: 'COMPLETED',
  statusLabel: 'Проведено',
};

const rows: AccountingMovementRow[] = [
  baseRow,
  {
    ...baseRow,
    id: 'movement-2',
    operationType: 'MVO_TRANSFER',
    operationLabel: 'Передача МВО',
    documentLabel: '№ 7',
    documentId: 'transfer-1',
    quantity: '-2',
    direction: '0057 — Жигульський Андрій Васильович → 0061 — Левіс Артур Сергійович',
    status: 'POSTED',
    transferredTo: {
      id: 'person-2',
      personnelNumber: '61',
      externalAccountingCode: '0061',
      fullName: 'Левіс Артур Сергійович',
    },
  },
  {
    ...baseRow,
    id: 'movement-3',
    operationType: 'ISSUE',
    operationLabel: 'Видача',
    documentLabel: '№ 8',
    documentId: 'issue-1',
    quantity: '3',
    direction: '0057 — Жигульський Андрій Васильович → Зовнішній одержувач',
    status: 'POSTED',
    transferredTo: {
      id: 'person-2',
      personnelNumber: '61',
      externalAccountingCode: '0061',
      fullName: 'Левіс Артур Сергійович',
    },
    issuedTo: 'Зовнішній одержувач',
    relatedDocument: {
      id: 'transfer-1',
      displayNumber: 7,
      label: 'Передача № 7',
    },
    hasAttachment: true,
  },
];

const details: AccountingMovementDetails = {
  kind: 'STOCK_DOCUMENT',
  sourceId: 'document-1',
  documentType: 'ISSUE',
  operationType: 'ISSUE',
  documentLabel: '№ 8',
  documentDate: '2026-08-07T00:00:00.000Z',
  status: 'POSTED',
  author: { id: 'user-1', username: 'accountant' },
  responsiblePerson: baseRow.responsiblePerson,
  destinationResponsiblePerson: rows[2].transferredTo,
  sourceTransfer: {
    id: 'transfer-1',
    displayNumber: 7,
    documentDate: '2026-08-06T00:00:00.000Z',
    status: 'POSTED',
    sourceResponsiblePerson: baseRow.responsiblePerson,
    destinationResponsiblePerson: rows[2].transferredTo,
  },
  counterparty: { fullName: 'Зовнішній одержувач', externalAccountingCode: null },
  recipientUnit: 'Підрозділ 1',
  basis: 'Накладна',
  note: 'Примітка',
  lines: [{
    inventoryItem: baseRow.inventoryItem,
    responsiblePerson: baseRow.responsiblePerson,
    quantity: '3',
    issuedQuantity: null,
    availableToIssue: null,
    note: null,
  }],
  attachments: [{
    id: 'attachment-1',
    documentId: 'document-1',
    originalFileName: 'накладна.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    sha256: 'hash',
    uploadedByUserId: 'user-1',
    createdAt: '2026-08-07T10:00:00.000Z',
  }],
  issues: [],
};

beforeEach(() => {
  mockList.mockResolvedValue({
    items: rows,
    pagination: { page: 1, limit: 25, total: 3, totalPages: 1 },
  });
  mockPersons.mockResolvedValue({
    items: [],
    pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
  });
  mockDetails.mockResolvedValue(details);
  mockDocumentDetails.mockResolvedValue(details);
  mockExport.mockResolvedValue({ blob: new Blob(['csv']), filename: 'movements.csv' });
});

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('AccountingMovementsView', () => {
  it('shows import, transfer and issue rows with signed quantities and accounting codes', async () => {
    render(<AccountingMovementsView />);

    expect(await screen.findByRole('table', { name: 'Бухгалтерський журнал руху майна' })).toBeTruthy();
    expect(screen.getAllByText('Надходження').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Передача МВО').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Видача').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0057').length).toBeGreaterThan(0);
    expect(screen.getByText('+10')).toBeTruthy();
    expect(screen.getByText('−2')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getAllByText('Є документ').length).toBeGreaterThan(0);
  });

  it('applies server-side filters with inclusive date values and supported pagination', async () => {
    const user = userEvent.setup();
    render(<AccountingMovementsView />);
    await screen.findByRole('table', { name: 'Бухгалтерський журнал руху майна' });

    await user.type(screen.getByLabelText('Дата від'), '2026-08-01');
    await user.type(screen.getByLabelText('Дата до'), '2026-08-07');
    await user.selectOptions(screen.getByLabelText('Тип операції'), 'MVO_TRANSFER');
    await user.type(screen.getByLabelText('Код МВО'), '0057');
    await user.type(screen.getByLabelText('Код/ПІБ, кому передано'), '0061');
    await user.type(screen.getByLabelText('Кому видано'), 'Склад');
    await user.click(screen.getByRole('button', { name: 'Застосувати' }));

    await waitFor(() => expect(mockList).toHaveBeenLastCalledWith(expect.objectContaining({
      dateFrom: '2026-08-01',
      dateTo: '2026-08-07',
      operationType: 'MVO_TRANSFER',
      mvoCode: '0057',
      transferRecipient: '0061',
      issueRecipient: 'Склад',
      page: 1,
      limit: 25,
    })));
    const limitSelect = screen.getByLabelText('Кількість записів на сторінці');
    expect(within(limitSelect).getAllByRole('option').map((option) => option.textContent)).toEqual(['25', '50', '100']);
  });

  it('exports with active filters and opens read-only document details', async () => {
    const user = userEvent.setup();
    render(<AccountingMovementsView />);
    await screen.findByRole('table', { name: 'Бухгалтерський журнал руху майна' });

    await user.type(screen.getByLabelText('Пошук'), 'Клавіатура');
    await user.click(screen.getByRole('button', { name: 'Застосувати' }));
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
    await user.click(screen.getByRole('button', { name: 'Експортувати CSV' }));
    await waitFor(() => expect(mockExport).toHaveBeenCalledWith(expect.objectContaining({ search: 'Клавіатура' })));
    expect(mockDownload).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: '№ 8' }));
    expect(await screen.findByRole('dialog', { name: 'Видача: № 8' })).toBeTruthy();
    expect(screen.getByText('накладна.pdf')).toBeTruthy();
    expect(screen.getByText(/PDF · 1\.0 КБ/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Редагувати|Провести|Скасувати документ|Видалити/ })).toBeNull();
  });
});

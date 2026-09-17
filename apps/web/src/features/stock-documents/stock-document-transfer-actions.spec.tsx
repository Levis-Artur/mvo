/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AuthUser, StockDocument } from '@/lib/types';
import { StockDocumentsTable } from './stock-documents-table';
import { StockDocumentDetailsModal } from './stock-document-details-modal';

afterEach(cleanup);

it('keeps MVO transfer viewing available and hides cancel in the table and details', () => {
  const user = { role: 'MVO', responsiblePersonId: 'person-1' } as AuthUser;
  const document = {
    id: 'transfer-1',
    displayNumber: 1,
    documentDate: '2026-09-16T00:00:00.000Z',
    type: 'MVO_TRANSFER',
    status: 'POSTED',
    accountingExportState: 'NOT_EXPORTED',
    sourceResponsiblePersonId: 'person-1',
    sourceResponsiblePerson: { lastName: 'Відправник', firstName: 'Тестовий' },
    destinationResponsiblePerson: { lastName: 'Одержувач', firstName: 'Тестовий' },
    createdByUser: { username: 'mvo' },
    lines: [{ quantity: '2', inventoryItem: { name: 'Ноутбук' } }],
    attachments: [],
    totalPositions: 1,
    totalQuantity: '2',
  } as StockDocument;
  const onView = jest.fn();
  const onCancel = jest.fn();
  const table = render(
    <StockDocumentsTable documents={[document]} user={user} loading={false} onView={onView} onCancel={onCancel} />,
  );

  expect(screen.queryByRole('button', { name: /Скасувати/ })).toBeNull();
  for (const name of ['№', 'Дата', 'Номенклатура', 'Кількість', 'Статус']) {
    expect(screen.getByRole('columnheader', { name })).toBeTruthy();
  }
  expect(screen.queryByRole('columnheader', { name: 'Обсяг' })).toBeNull();
  expect(screen.getByText('Ноутбук')).toBeTruthy();
  expect(screen.getByText('2')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути документ № 1', exact: true }));
  expect(onView).toHaveBeenCalledWith(document);
  table.unmount();

  render(
    <StockDocumentDetailsModal document={document} user={user} loading={false} error="" onCancel={onCancel} onClose={jest.fn()} />,
  );
  expect(screen.getByRole('dialog')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Скасувати/ })).toBeNull();
  expect(onCancel).not.toHaveBeenCalled();
});

it('shows manager transfer attachments and keeps details read-only', () => {
  const user = { role: 'ORG_MANAGER' } as AuthUser;
  const document = {
    id: 'transfer-1', displayNumber: 1, documentDate: '2026-09-16',
    type: 'MVO_TRANSFER', status: 'POSTED',
    sourceResponsiblePerson: { lastName: 'Відправник', firstName: 'Тестовий' },
    destinationResponsiblePerson: { lastName: 'Одержувач', firstName: 'Тестовий' },
    createdByUser: { username: 'mvo' },
    lines: [{ quantity: '2', inventoryItem: { name: 'Ноутбук' } }],
    attachments: [{ id: 'attachment', documentId: 'transfer-1', originalFileName: 'Передача.pdf', mimeType: 'application/pdf', sizeBytes: 100 }],
    totalPositions: 1, totalQuantity: '2',
  } as StockDocument;
  const onView = jest.fn();
  const onCancel = jest.fn();
  const table = render(<StockDocumentsTable documents={[document]} user={user}
    loading={false} onView={onView} onCancel={onCancel} />);
  expect(screen.getByRole('columnheader', { name: 'Документ', exact: true })).toBeTruthy();
  expect(screen.getByText('Є документ')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Переглянути документ № 1', exact: true }));
  expect(onView).toHaveBeenCalledWith(document);
  expect(screen.queryByRole('button', { name: /Скасувати/ })).toBeNull();
  table.unmount();
  render(<StockDocumentDetailsModal document={document} user={user} loading={false}
    error="" readOnly onCancel={onCancel} onClose={jest.fn()} />);
  expect(screen.getByText('Передача.pdf')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Переглянути Передача.pdf' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Завантажити' }).getAttribute('href')).toContain('/stock-documents/transfer-1/attachments/attachment/download');
  expect(screen.queryByRole('button', { name: /Скасувати|Реалізувати|Видати|Передати|Додати вкладення/ })).toBeNull();
  expect(onCancel).not.toHaveBeenCalled();
});

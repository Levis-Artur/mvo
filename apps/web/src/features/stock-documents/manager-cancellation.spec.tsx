/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { AuthUser, StockDocument } from '@/lib/types';
import { ReadOnlyDocumentDetails } from './read-only-document-details';
import { stockDocumentsService } from './stock-documents.service';

let mockUser = { role: 'ORG_MANAGER' } as AuthUser;
jest.mock('@/app/ui/auth-context', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('./stock-documents.service', () => ({ stockDocumentsService: { findOne: jest.fn(), cancel: jest.fn() } }));

function document(type: 'MVO_TRANSFER' | 'ISSUE' = 'MVO_TRANSFER'): StockDocument {
  return {
    id: 'document-1', displayNumber: 7, type, status: 'POSTED',
    accountingModel: 'DIRECT_BALANCE', accountingExportState: 'NOT_EXPORTED', canManagerCancel: true,
    documentDate: '2026-09-17', createdAt: '2026-09-17', sourceResponsiblePersonId: 'source',
    sourceResponsiblePerson: { lastName: 'Відправник', firstName: 'Тестовий' },
    destinationResponsiblePerson: { lastName: 'Одержувач', firstName: 'Тестовий' },
    recipientName: 'Одержувач', createdByUser: { username: 'mvo' },
    lines: [{ id: 'line', quantity: '2', availableToRealize: '2', inventoryItem: { name: 'Ноутбук', unitOfMeasure: 'шт.' } }],
    attachments: [], realizations: [], issues: [], totalPositions: 1, totalQuantity: '2', availableToRealize: '2',
  } as StockDocument;
}

beforeEach(() => { jest.clearAllMocks(); mockUser = { role: 'ORG_MANAGER' } as AuthUser; });
afterEach(cleanup);

it.each(['MVO_TRANSFER', 'ISSUE'] as const)('requires a trimmed reason and refreshes %s after cancellation', async (type) => {
  const original = document(type);
  const findOne = jest.mocked(stockDocumentsService.findOne);
  findOne.mockResolvedValueOnce(original).mockResolvedValue({ ...original, status: 'CANCELLED' });
  jest.mocked(stockDocumentsService.cancel).mockResolvedValue({ ...original, status: 'CANCELLED' });
  const completed = jest.fn();
  const refresh = jest.fn();
  window.addEventListener('mvo:refresh-stock', refresh);
  try {
    render(<ReadOnlyDocumentDetails documentId={original.id} onClose={jest.fn()} onCompleted={completed} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Скасувати', exact: true }));
    expect(screen.getByText('Операцію буде скасовано з формуванням зворотного облікового руху.')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: /Причина скасування/ }), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Скасувати операцію' }));
    expect(screen.getByText('Вкажіть причину скасування (від 1 до 1000 символів).')).toBeTruthy();
    expect(stockDocumentsService.cancel).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('textbox', { name: /Причина скасування/ }), { target: { value: '  Помилковий одержувач  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Скасувати операцію' }));
    await waitFor(() => expect(stockDocumentsService.cancel).toHaveBeenCalledWith(original.id, 'Помилковий одержувач'));
    expect(await screen.findByText('Операцію скасовано.')).toBeTruthy();
    expect(completed).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(findOne).toHaveBeenCalledTimes(2);
    expect(findOne).toHaveBeenLastCalledWith(original.id, 'SCOPED_READ');
    await waitFor(() => expect(screen.queryByRole('button', { name: /Скасувати/ })).toBeNull());
  } finally { window.removeEventListener('mvo:refresh-stock', refresh); }
});

it.each([
  { role: 'MVO', changes: {} },
  { role: 'ORG_MANAGER', changes: { canManagerCancel: false } },
  { role: 'ORG_MANAGER', changes: { status: 'CANCELLED' } },
  { role: 'ORG_MANAGER', changes: { accountingExportState: 'EXPORTED' } },
  { role: 'ORG_MANAGER', changes: { issues: [{ id: 'child', status: 'POSTED', documentDate: '2026-09-17', displayNumber: 8, totalPositions: 1, totalQuantity: '2', availableToRealize: '2', attachments: [] }] } },
  { role: 'ORG_MANAGER', changes: { type: 'ISSUE', realizations: [{ id: 'realization', status: 'POSTED', realizationDate: '2026-09-17', createdAt: '2026-09-17', createdByUser: { username: 'manager' }, lines: [], attachments: [], totalQuantity: '1' }] } },
])('hides cancellation for a forbidden or non-cancellable document: %j', async ({ role, changes }) => {
  mockUser = { role } as AuthUser;
  jest.mocked(stockDocumentsService.findOne).mockResolvedValue({ ...document(), ...changes } as StockDocument);
  render(<ReadOnlyDocumentDetails documentId="document-1" onClose={jest.fn()} />);
  await screen.findByRole('button', { name: 'Закрити', exact: true });
  expect(screen.queryByRole('button', { name: /Скасувати/ })).toBeNull();
});

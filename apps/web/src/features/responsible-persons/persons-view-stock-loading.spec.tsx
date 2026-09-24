/** @jest-environment jsdom */

import { StrictMode } from 'react';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui';
import type { ResponsiblePerson, ResponsiblePersonAccountingCard, StockDocument, IssueRealization } from '@/lib/types';
import { PersonsView } from './persons-view';
import { responsiblePersonsService } from './responsible-persons.service';
import { PersonDetailsModal } from './person-details-modal';
import { stockDocumentsService } from '@/features/stock-documents/stock-documents.service';
import { apiClient } from '@/lib/api-client';

let mockRole: 'ORG_MANAGER' | 'OWNER' = 'ORG_MANAGER';

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  mockRole = 'ORG_MANAGER';
});

jest.mock('@/app/ui/auth-context', () => ({
  useAuth: () => ({ user: { role: mockRole } }),
}));

jest.mock('./responsible-persons.service', () => ({
  responsiblePersonsService: {
    managements: jest.fn(),
    services: jest.fn(),
    units: jest.fn(),
    responsiblePersons: jest.fn(),
    responsiblePersonAccountingCard: jest.fn(),
  },
}));

// Keep the actual details modal, stock tab and DataTable. Only replace the
// registry table and unrelated dialogs to isolate the loading callback chain.
jest.mock('./persons-table', () => ({
  PersonsTable: ({ persons, stockPresence, onView }: {
    persons: ResponsiblePerson[];
    stockPresence: Record<string, boolean>;
    onView: (person: ResponsiblePerson) => void;
  }) => (
    <div>
      {persons.map((person) => (
        <div key={person.id}>
          <Button type="button" onClick={() => onView(person)}>Відкрити картку МВО</Button>
          <output data-testid="stock-presence">
            {String(stockPresence[person.id] ?? 'unknown')}
          </output>
        </div>
      ))}
    </div>
  ),
}));

jest.mock('./create-mvo-account-modal', () => ({ CreateMvoAccountModal: () => null }));
jest.mock('./person-form', () => ({ PersonForm: () => null }));
jest.mock('@/features/admin/destructive-action-modal', () => ({
  DestructiveActionModal: () => null,
}));

it('shows operation controls and global ISSUE history in an MVO card for OWNER', async () => {
  mockRole = 'OWNER';
  const issueHistory = jest.spyOn(stockDocumentsService, 'issueHistory').mockResolvedValue({
    items: [], pagination: { page: 1, limit: 25, total: 0, totalPages: 0 },
  });
  const person = {
    id: 'owner-target', firstName: 'Іван', lastName: 'Іваненко', middleName: 'Іванович',
    externalAccountingCode: '9002', isActive: true, position: 'Інспектор',
    management: { name: 'Управління' }, service: { name: 'Служба' }, unit: null,
  } as ResponsiblePerson;
  render(<PersonDetailsModal person={person} accountLookupAvailable={false}
    canEdit canCreateAccount canDelete onClose={jest.fn()} onEdit={jest.fn()}
    onCreateAccount={jest.fn()} onToggleActive={jest.fn()} onDelete={jest.fn()}
    onStockPresence={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Передати', exact: true })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Видати', exact: true })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Видачі', exact: true })).toBeTruthy();
  await userEvent.setup().click(screen.getByRole('button', { name: 'Видачі', exact: true }));
  await waitFor(() => expect(issueHistory).toHaveBeenCalledWith(expect.objectContaining({
    sourceResponsiblePersonId: person.id, accessMode: undefined,
  })));
});

it('shows stock rows after reporting presence and does not reload on a parent render', async () => {
  const api = jest.mocked(responsiblePersonsService);
  const person = {
    id: 'person-1',
    firstName: 'Олена',
    lastName: 'Тестова',
    middleName: null,
    externalAccountingCode: '001',
    isActive: true,
    management: { name: 'Управління' },
    service: { name: 'Служба' },
    unit: null,
  } as ResponsiblePerson;
  const card = {
    directBalances: [{
      inventoryItem: { externalCode: 'INV-001', name: 'Тестовий ноутбук' },
      quantity: '3',
      unrealizedQuantity: '1.25',
    }],
    totalDirectQuantity: '3',
  } as ResponsiblePersonAccountingCard;
  const pending: Array<(result: ResponsiblePersonAccountingCard) => void> = [];
  api.managements.mockResolvedValue([]);
  api.services.mockResolvedValue([]);
  api.units.mockResolvedValue([]);
  api.responsiblePersons.mockResolvedValue({
    items: [person],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  });
  api.responsiblePersonAccountingCard.mockImplementation(
    () => new Promise((resolve) => pending.push(resolve)),
  );

  const user = userEvent.setup();
  const { rerender } = render(<StrictMode><PersonsView /></StrictMode>);
  await user.click(await screen.findByRole('button', { name: 'Відкрити картку МВО' }));
  await user.click(screen.getByRole('button', { name: 'Залишки', exact: true }));
  await waitFor(() => expect(api.responsiblePersonAccountingCard).toHaveBeenCalled());

  // StrictMode may start the effect twice. Resolve all initial requests and
  // compare against that baseline, rather than requiring exactly one call.
  const initialRequestCount = api.responsiblePersonAccountingCard.mock.calls.length;
  expect(api.responsiblePersonAccountingCard.mock.calls.every(([id]) => id === person.id)).toBe(true);
  expect(screen.getByTestId('stock-presence').textContent).toBe('unknown');
  await act(async () => {
    pending.slice().forEach((resolve) => resolve(card));
  });

  await waitFor(() => expect(screen.getByTestId('stock-presence').textContent).toBe('true'));
  const table = screen.getByRole('table', { name: 'Поточні прямі залишки МВО' });
  expect(within(table).getByRole('cell', { name: 'Тестовий ноутбук' })).toBeTruthy();
  expect(within(table).getByRole('columnheader', { name: 'Залишок на складі' })).toBeTruthy();
  expect(within(table).getByRole('columnheader', { name: 'Нереалізовано' })).toBeTruthy();
  expect(table.querySelector('td[data-label="Нереалізовано"]')?.textContent).toBe('1,25');
  expect(api.responsiblePersonAccountingCard).toHaveBeenCalledTimes(initialRequestCount);

  rerender(<StrictMode><PersonsView /></StrictMode>);
  expect(within(screen.getByRole('table', { name: 'Поточні прямі залишки МВО' }))
    .getByRole('cell', { name: 'Тестовий ноутбук' })).toBeTruthy();
  expect(api.responsiblePersonAccountingCard).toHaveBeenCalledTimes(initialRequestCount);
});

it('shows scoped ISSUE attachments and realization for the selected MVO without manager cancellation', async () => {
  const person = {
    id: 'scoped-person', firstName: 'Олена', lastName: 'Тестова',
    middleName: null, externalAccountingCode: '9001', isActive: true,
    management: { name: 'Управління' }, service: { name: 'Служба' }, unit: null,
  } as ResponsiblePerson;
  const history = jest.spyOn(stockDocumentsService, 'issueHistory').mockResolvedValue({
    items: [{
      id: 'issue-1', displayNumber: 19, documentDate: '2026-09-16T00:00:00.000Z',
      sourceResponsiblePerson: { id: person.id, fullName: 'Тестова Олена', externalAccountingCode: '9001' },
      recipientName: 'Одержувач видачі', note: null, status: 'POSTED',
      numberOfLines: 2, inventoryNames: ['Ноутбук', 'Монітор'],
      totalQuantity: '3', issuedQuantity: '3', realizedQuantity: '0',
      availableToRealize: '3', realizationCount: 0, isFullyRealized: false,
      hasAttachment: true, createdBy: { id: 'mvo', username: 'mvo', role: 'MVO' },
      createdAt: '2026-09-16T00:00:00.000Z',
    }],
    pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
  });
  const details = jest.spyOn(stockDocumentsService, 'findOne').mockResolvedValue({
    id: 'issue-1', displayNumber: 19, type: 'ISSUE', status: 'POSTED',
    sourceResponsiblePersonId: person.id,
    documentDate: '2026-09-16', createdAt: '2026-09-16', recipientName: 'Одержувач видачі',
    totalQuantity: '3', issuedQuantity: '3', availableToRealize: '2',
    lines: [{ id: 'line', inventoryItem: { name: 'Ноутбук', externalCode: 'INV-001', unitOfMeasure: 'шт.' }, quantity: '3', availableToRealize: '2' }],
    attachments: [{ id: 'attachment', documentId: 'issue-1', originalFileName: 'Видача.pdf', mimeType: 'application/pdf', sizeBytes: 100 }],
    realizations: [{
      id: 'realization', displayNumber: 4, realizationDate: '2026-09-16', status: 'POSTED',
      totalQuantity: '1', hasAttachment: true, lines: [],
      attachments: [{ id: 'realization-attachment', originalFileName: 'Реалізація.pdf', mimeType: 'application/pdf', sizeBytes: 100 }],
    }],
  } as StockDocument);
  render(<PersonDetailsModal
    accessMode="SCOPED_READ" person={person} accountLookupAvailable={false}
    canEdit={false} canCreateAccount={false} canDelete={false}
    onClose={jest.fn()} onEdit={jest.fn()} onCreateAccount={jest.fn()}
    onToggleActive={jest.fn()} onDelete={jest.fn()} onStockPresence={jest.fn()}
  />);
  expect(screen.getByRole('button', { name: 'Передачі', exact: true })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Передати', exact: true })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Видати', exact: true })).toBeTruthy();
  const availableStock = jest.spyOn(apiClient, 'availableStockToMe').mockResolvedValue([]);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Видати', exact: true }));
  const issueForm = screen.getByRole('dialog', { name: 'Нова видача — Тестова Олена' });
  expect(within(issueForm).getByText(/Операція від імені МВО:/)).toBeTruthy();
  expect(within(issueForm).getByText('Тестова Олена')).toBeTruthy();
  await waitFor(() => expect(availableStock).toHaveBeenCalledWith(person.id));
  expect(within(issueForm).queryByLabelText(/МВО-відправник/)).toBeNull();
  await userEvent.setup().click(within(issueForm).getAllByRole('button', { name: 'Закрити', exact: true })[0]!);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Видачі', exact: true }));
  const table = await screen.findByRole('table', { name: 'Історія видач' });
  expect(within(table).getByText('№ 19')).toBeTruthy();
  expect(within(table).getByText('Одержувач видачі')).toBeTruthy();
  expect(within(table).getByText('Ноутбук, Монітор')).toBeTruthy();
  expect(within(table).getByRole('columnheader', { name: 'Не реалізовано' })).toBeTruthy();
  expect(table.querySelector('td[data-label="Не реалізовано"]')?.textContent).toBe('3');
  expect(history).toHaveBeenCalledWith(expect.objectContaining({
    sourceResponsiblePersonId: person.id, accessMode: 'SCOPED_READ',
  }));
  expect(within(table).getByRole('button', { name: 'Відкрити' })).toBeTruthy();
  await userEvent.setup().click(within(table).getByRole('button', { name: 'Відкрити' }));
  expect(await screen.findByText('Видача.pdf')).toBeTruthy();
  expect(details).toHaveBeenCalledWith('issue-1', 'SCOPED_READ');
  expect(screen.getByRole('button', { name: 'Переглянути Видача.pdf' })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Завантажити' }).getAttribute('href')).toContain('/stock-documents/issue-1/attachments/attachment/download');
  const createRealization = jest.spyOn(stockDocumentsService, 'createIssueRealization').mockResolvedValue({} as IssueRealization);
  await userEvent.setup().click(screen.getByRole('button', { name: 'Реалізувати', exact: true }));
  expect(screen.getByText(/Операція від імені МВО:/)).toBeTruthy();
  expect(screen.getByText('Тестова Олена')).toBeTruthy();
  await userEvent.setup().type(screen.getByRole('spinbutton', { name: 'Кількість до реалізації' }), '1');
  await userEvent.setup().click(screen.getByRole('button', { name: 'Підтвердити реалізацію' }));
  await waitFor(() => expect(createRealization).toHaveBeenCalledWith('issue-1', expect.objectContaining({
    targetResponsiblePersonId: person.id, lines: [{ issueLineId: 'line', quantity: '1' }],
  }), []));
  await screen.findByText('Видача.pdf');
  await userEvent.setup().click(screen.getByRole('button', { name: 'Переглянути', exact: true }));
  expect(await screen.findByText('Реалізація.pdf')).toBeTruthy();
  expect(within(screen.getByText('Реалізація.pdf').closest('li')!).getByRole('button', { name: 'Переглянути' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Реалізувати', exact: true })).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Нова видача|Скасувати видачу|Скасувати реалізацію|Редагувати/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /Завантажити файл|Додати вкладення|Видалити вкладення/ })).toBeNull();
});

/** @jest-environment jsdom */

import { cleanup, render, screen, waitFor, renderHook, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthUser, StockTransaction } from '@/lib/types';
import { ManagerReadOnlyView } from './manager-read-only-view';
import { StockDocumentsView } from '../stock-documents/stock-documents-view';
import { useStockDocumentsController } from '../stock-documents/use-stock-documents-controller';
import { stockDocumentsService } from '../stock-documents/stock-documents.service';
import { inventoryService } from '../inventory/inventory.service';

const mockUser: AuthUser = {
  id: 'mvo', username: 'mvo', role: 'MVO', isActive: true, mustChangePassword: false,
  responsiblePersonId: 'own-person', accessScopes: [{ managementId: null, serviceCode: 'IT' }],
};

jest.mock('@/app/ui/auth-context', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('../responsible-persons/persons-view', () => ({
  PersonsView: ({ accessMode }: { accessMode?: string }) => <p>Persons mode: {accessMode}</p>,
}));
jest.mock('../inventory/inventory.service', () => ({
  inventoryService: {
    managements: jest.fn(), services: jest.fn(), units: jest.fn(),
    responsiblePersons: jest.fn(), inventoryItems: jest.fn(),
    stockBalances: jest.fn(), stockTransactions: jest.fn(),
  },
}));
jest.mock('../stock-documents/stock-documents.service', () => ({
  stockDocumentsService: { list: jest.fn(), persons: jest.fn(), findOne: jest.fn(), issueHistory: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  const emptyPage = { items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } };
  const inventory = jest.mocked(inventoryService);
  inventory.managements.mockResolvedValue([]);
  inventory.services.mockResolvedValue([]);
  inventory.units.mockResolvedValue([]);
  inventory.responsiblePersons.mockResolvedValue(emptyPage);
  inventory.inventoryItems.mockResolvedValue(emptyPage);
  inventory.stockBalances.mockResolvedValue(emptyPage);
  inventory.stockTransactions.mockResolvedValue(emptyPage);
  jest.mocked(stockDocumentsService.list).mockResolvedValue(emptyPage);
  jest.mocked(stockDocumentsService.persons).mockResolvedValue(emptyPage);
  jest.mocked(stockDocumentsService.issueHistory).mockResolvedValue(emptyPage);
});
afterEach(cleanup);

it('sends explicit scoped mode from manager stock, journal and transfers, with no write actions', async () => {
  jest.mocked(inventoryService.stockTransactions).mockResolvedValue({
    items: [{
      id: 'transaction', type: 'INITIAL_BALANCE', occurredAt: '2026-09-17', quantity: '2',
      responsiblePerson: { fullName: 'Тестовий МВО', externalAccountingCode: '0057' },
      inventoryItem: { externalCode: 'ITEM-1', name: 'Ноутбук' }, sourceDocument: 'Початковий залишок',
    } as StockTransaction],
    pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
  });
  const browser = userEvent.setup();
  render(<ManagerReadOnlyView />);
  expect(screen.getByText('Persons mode: SCOPED_READ')).toBeTruthy();
  await browser.click(screen.getByRole('button', { name: 'Залишки', exact: true }));
  await waitFor(() => expect(inventoryService.stockBalances).toHaveBeenCalledWith(expect.objectContaining({ accessMode: 'SCOPED_READ' })));
  expect(screen.queryByText('Нульові або проблемні')).toBeNull();
  expect(screen.queryByText('Останнє оновлення')).toBeNull();
  expect(screen.queryByRole('columnheader', { name: 'Остання операція' })).toBeNull();
  expect(screen.queryByRole('columnheader', { name: 'Оновлено' })).toBeNull();
  await browser.click(screen.getByRole('button', { name: 'Журнал операцій', exact: true }));
  await waitFor(() => expect(inventoryService.stockTransactions).toHaveBeenCalledWith(expect.objectContaining({ accessMode: 'SCOPED_READ' })));
  for (const name of ['Користувач', 'requestId', 'Статус', 'Напрямок']) {
    expect(screen.queryByRole('columnheader', { name })).toBeNull();
  }
  expect(await screen.findByRole('columnheader', { name: 'Номенклатура' })).toBeTruthy();
  await browser.click(screen.getByRole('button', { name: 'Передачі', exact: true }));
  await waitFor(() => expect(stockDocumentsService.list).toHaveBeenCalledWith(expect.objectContaining({ accessMode: 'SCOPED_READ' })));
  expect(screen.queryByRole('button', { name: 'Нова передача' })).toBeNull();
  await browser.click(screen.getByRole('button', { name: 'Видачі', exact: true }));
  await waitFor(() => expect(stockDocumentsService.issueHistory).toHaveBeenCalledWith(expect.objectContaining({ accessMode: 'SCOPED_READ' })));
  expect(await screen.findByText('Видач ще немає')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Нова видача|Скасувати|Реалізувати/ })).toBeNull();
});

it('does not request scoped mode on operational transfers even when the MVO has scopes', async () => {
  render(<StockDocumentsView />);
  await waitFor(() => expect(stockDocumentsService.list).toHaveBeenCalled());
  const [query] = jest.mocked(stockDocumentsService.list).mock.calls[0];
  expect(query.type).toBe('MVO_TRANSFER');
  expect(query.accessMode).toBeUndefined();
  expect(screen.getByRole('button', { name: 'Нова передача' })).toBeTruthy();
});

it('hides diagnostic stock summaries for ORG_MANAGER and keeps the registry and navigation', async () => {
  const originalRole = mockUser.role;
  mockUser.role = 'ORG_MANAGER';
  try {
    const browser = userEvent.setup();
    render(<ManagerReadOnlyView />);
    expect(screen.getByText('Persons mode: SCOPED_READ')).toBeTruthy();
    for (const name of ['МВО', 'Залишки', 'Журнал операцій', 'Передачі', 'Видачі']) {
      expect(screen.getByRole('button', { name, exact: true })).toBeTruthy();
    }
    await browser.click(screen.getByRole('button', { name: 'Залишки', exact: true }));
    await waitFor(() => expect(inventoryService.stockBalances).toHaveBeenCalled());
    expect(screen.queryByText('Нульові або проблемні')).toBeNull();
    expect(screen.queryByText('Останнє оновлення')).toBeNull();
    expect(screen.getByText('МВО із залишками')).toBeTruthy();
    expect(await screen.findByText('Залишків за вказаними фільтрами не знайдено.')).toBeTruthy();
    await browser.click(screen.getByRole('button', { name: 'МВО', exact: true }));
    expect(screen.getByText('Persons mode: SCOPED_READ')).toBeTruthy();
  } finally {
    mockUser.role = originalRole;
  }
});

it('preserves explicit manager mode when opening a document by ID', async () => {
  const { result } = renderHook(() => useStockDocumentsController(mockUser, 'SCOPED_READ'));
  await act(async () => { await result.current.openDetails({ id: 'scoped-document' }); });
  expect(stockDocumentsService.findOne).toHaveBeenCalledWith('scoped-document', 'SCOPED_READ');
});

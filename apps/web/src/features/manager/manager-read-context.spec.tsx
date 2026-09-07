/** @jest-environment jsdom */

import { cleanup, render, screen, waitFor, renderHook, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthUser } from '@/lib/types';
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
  stockDocumentsService: { list: jest.fn(), persons: jest.fn(), findOne: jest.fn() },
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
});
afterEach(cleanup);

it('sends explicit scoped mode from manager stock, journal and transfers, with no write actions', async () => {
  const browser = userEvent.setup();
  render(<ManagerReadOnlyView />);
  expect(screen.getByText('Persons mode: SCOPED_READ')).toBeTruthy();
  await browser.click(screen.getByRole('button', { name: 'Залишки', exact: true }));
  await waitFor(() => expect(inventoryService.stockBalances).toHaveBeenCalledWith(expect.objectContaining({ accessMode: 'SCOPED_READ' })));
  await browser.click(screen.getByRole('button', { name: 'Журнал операцій', exact: true }));
  await waitFor(() => expect(inventoryService.stockTransactions).toHaveBeenCalledWith(expect.objectContaining({ accessMode: 'SCOPED_READ' })));
  await browser.click(screen.getByRole('button', { name: 'Передачі', exact: true }));
  await waitFor(() => expect(stockDocumentsService.list).toHaveBeenCalledWith(expect.objectContaining({ accessMode: 'SCOPED_READ' })));
  expect(screen.queryByRole('button', { name: 'Нова передача' })).toBeNull();
});

it('does not request scoped mode on operational transfers even when the MVO has scopes', async () => {
  render(<StockDocumentsView />);
  await waitFor(() => expect(stockDocumentsService.list).toHaveBeenCalled());
  const [query] = jest.mocked(stockDocumentsService.list).mock.calls[0];
  expect(query.type).toBe('MVO_TRANSFER');
  expect(query.accessMode).toBeUndefined();
  expect(screen.getByRole('button', { name: 'Нова передача' })).toBeTruthy();
});

it('preserves explicit manager mode when opening a document by ID', async () => {
  const { result } = renderHook(() => useStockDocumentsController(mockUser, 'SCOPED_READ'));
  await act(async () => { await result.current.openDetails({ id: 'scoped-document' }); });
  expect(stockDocumentsService.findOne).toHaveBeenCalledWith('scoped-document', 'SCOPED_READ');
});

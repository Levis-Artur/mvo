/** @jest-environment jsdom */

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AuthUser, DirectMyPropertyItem, MyPropertyQuery } from '@/lib/types';
import { MyStockView } from './my-stock-view';
import { responsiblePersonsService } from './responsible-persons.service';

const authUser: AuthUser = {
  id: 'mvo-user', username: 'mvo', role: 'MVO', isActive: true,
  mustChangePassword: false, responsiblePersonId: 'own-person',
  accessScopes: [{ managementId: null, serviceCode: 'IT' }],
};

const rows: DirectMyPropertyItem[] = [
  {
    section: 'DIRECT', id: 'balance-positive', quantity: '5',
    unrealizedQuantity: '2', updatedAt: '2026-09-07T00:00:00.000Z',
    inventoryItem: { id: 'item-positive', externalCode: 'KB-001', name: 'Клавіатура', unitOfMeasure: 'шт' },
  },
  {
    section: 'DIRECT', id: 'balance-zero', quantity: '3',
    unrealizedQuantity: '0', updatedAt: '2026-09-07T00:00:00.000Z',
    inventoryItem: { id: 'item-zero', externalCode: 'MS-001', name: 'Миша', unitOfMeasure: 'шт' },
  },
];

jest.mock('@/app/ui/auth-context', () => ({ useAuth: () => ({ user: authUser }) }));
jest.mock('./responsible-persons.service', () => ({
  responsiblePersonsService: {
    myProperty: jest.fn(),
    exportMyPropertyCsv: jest.fn(),
    myInventoryItemTransferHistory: jest.fn(),
    myInventoryItemMovementHistory: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(responsiblePersonsService.myProperty).mockImplementation(
    async (query: MyPropertyQuery) => {
      const filtered = rows.filter((row) =>
        (!query.unrealizedOnly || Number(row.unrealizedQuantity) > 0) &&
        (!query.search || `${row.inventoryItem.externalCode} ${row.inventoryItem.name}`
          .toLocaleLowerCase('uk-UA').includes(query.search.toLocaleLowerCase('uk-UA'))),
      );
      return {
        items: filtered,
        pagination: { page: query.page, limit: query.limit, total: filtered.length, totalPages: filtered.length ? 1 : 0 },
      };
    },
  );
});
afterEach(cleanup);

it('combines the direct unrealized filter with search and backend pagination', async () => {
  const browser = userEvent.setup();
  render(<MyStockView />);

  const table = await screen.findByRole('table', { name: 'У мене' });
  expect(within(table).getByText('Клавіатура')).toBeTruthy();
  expect(within(table).getByText('Миша')).toBeTruthy();
  expect(jest.mocked(responsiblePersonsService.myProperty).mock.calls[0][0])
    .toMatchObject({ section: 'DIRECT', page: 1 });
  expect(jest.mocked(responsiblePersonsService.myProperty).mock.calls[0][0].unrealizedOnly)
    .toBeUndefined();

  await browser.click(screen.getByRole('button', { name: 'Є нереалізовані' }));
  await waitFor(() => expect(responsiblePersonsService.myProperty)
    .toHaveBeenLastCalledWith(expect.objectContaining({ unrealizedOnly: true, page: 1 })));
  await waitFor(() => {
    const filteredTable = screen.getByRole('table', { name: 'У мене' });
    expect(within(filteredTable).getByText('Клавіатура')).toBeTruthy();
    expect(within(filteredTable).queryByText('Миша')).toBeNull();
    expect(screen.getByText(/Записів: 1\./)).toBeTruthy();
  });

  fireEvent.change(screen.getByRole('searchbox', { name: 'Пошук майна' }), {
    target: { value: 'KB-001' },
  });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 450)); });
  await waitFor(() => expect(responsiblePersonsService.myProperty)
    .toHaveBeenLastCalledWith(expect.objectContaining({
      search: 'KB-001', unrealizedOnly: true, page: 1,
    })));

  await browser.click(screen.getByRole('button', { name: 'Передано іншим МВО' }));
  expect(screen.queryByRole('navigation', { name: 'Фільтр нереалізованого майна' })).toBeNull();
  await waitFor(() => expect(responsiblePersonsService.myProperty)
    .toHaveBeenLastCalledWith(expect.objectContaining({ section: 'TRANSFERRED', page: 1 })));
  expect(jest.mocked(responsiblePersonsService.myProperty).mock.calls.at(-1)?.[0].unrealizedOnly)
    .toBeUndefined();
  expect(jest.mocked(responsiblePersonsService.myProperty).mock.calls.every(
    ([query]) => !('responsiblePersonId' in query) && !('accessMode' in query),
  )).toBe(true);
});

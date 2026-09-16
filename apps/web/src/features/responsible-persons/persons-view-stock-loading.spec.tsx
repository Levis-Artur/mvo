/** @jest-environment jsdom */

import { StrictMode } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/components/ui';
import type { ResponsiblePerson, ResponsiblePersonAccountingCard } from '@/lib/types';
import { PersonsView } from './persons-view';
import { responsiblePersonsService } from './responsible-persons.service';

jest.mock('@/app/ui/auth-context', () => ({
  useAuth: () => ({ user: { role: 'ORG_MANAGER' } }),
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
  expect(api.responsiblePersonAccountingCard).toHaveBeenCalledTimes(initialRequestCount);

  rerender(<StrictMode><PersonsView /></StrictMode>);
  expect(within(screen.getByRole('table', { name: 'Поточні прямі залишки МВО' }))
    .getByRole('cell', { name: 'Тестовий ноутбук' })).toBeTruthy();
  expect(api.responsiblePersonAccountingCard).toHaveBeenCalledTimes(initialRequestCount);
});

/** @jest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  AuthUser,
  AvailableStockSource,
  MyInventoryItemMovementHistory,
  TransferTarget,
} from '@/lib/types';
import { MyInventoryItemCard } from './my-inventory-item-card';
import { responsiblePersonsService } from './responsible-persons.service';
import { stockDocumentsService } from '../stock-documents/stock-documents.service';

const personId = '11111111-1111-4111-8111-111111111111';
const itemId = '22222222-2222-4222-8222-222222222222';
const balanceId = '33333333-3333-4333-8333-333333333333';
const targetId = '44444444-4444-4444-8444-444444444444';

const user: AuthUser = {
  id: '55555555-5555-4555-8555-555555555555',
  username: 'mvo-a',
  role: 'MVO',
  isActive: true,
  mustChangePassword: false,
  responsiblePersonId: personId,
};

const source: AvailableStockSource = {
  inventoryItem: {
    id: itemId,
    externalCode: 'KB-001',
    name: 'Клавіатура',
    unitOfMeasure: 'шт.',
  },
  balanceId,
  availableQuantity: '8',
  unit: 'шт.',
  canTransfer: true,
  canIssue: true,
};

const target: TransferTarget = {
  id: targetId,
  personnelNumber: '002',
  externalAccountingCode: '0002',
  fullName: 'Петренко Петро',
  management: { id: 'management-1', name: 'Управління Б' },
  service: { id: 'service-1', name: 'Служба Б' },
  unit: null,
};

const history: MyInventoryItemMovementHistory = {
  inventoryItem: {
    id: itemId,
    code: 'KB-001',
    name: 'Клавіатура',
    unit: 'шт.',
  },
  currentBalance: '8',
  items: [
    {
      id: 'movement-1',
      occurredAt: '2026-08-11T10:00:00.000Z',
      category: 'IMPORT',
      typeLabel: 'Прихід за CSV',
      from: 'Бухгалтерський CSV',
      to: '0001 — Іваненко Іван',
      quantity: '10',
      balanceBefore: '0',
      balanceAfter: '10',
      documentNumber: 'import.csv',
      source: 'Імпорт: import.csv',
      note: null,
      user: 'accountant',
      responsiblePerson: {
        id: personId,
        fullName: 'Іваненко Іван',
        personnelNumber: '001',
        externalAccountingCode: '0001',
        management: { id: 'management-1', name: 'Управління А' },
        service: { id: 'service-1', name: 'Служба А' },
        unit: null,
      },
      documentId: null,
      importBatchId: 'import-1',
    },
  ],
  pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
};

jest.mock('@/app/ui/auth-context', () => ({
  useAuth: () => ({ user }),
}));

jest.mock('./responsible-persons.service', () => ({
  responsiblePersonsService: {
    myInventoryItemMovementHistory: jest.fn(),
  },
}));

jest.mock('../stock-documents/stock-documents.service', () => ({
  stockDocumentsService: {
    availableToMe: jest.fn(),
    transferTargets: jest.fn(),
    createAndPostMvoTransfer: jest.fn(),
    createAndPostIssue: jest.fn(),
  },
}));

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('MyInventoryItemCard', () => {
  beforeEach(() => {
    jest
      .mocked(responsiblePersonsService.myInventoryItemMovementHistory)
      .mockResolvedValue(history);
    jest.mocked(stockDocumentsService.availableToMe).mockResolvedValue([source]);
    jest.mocked(stockDocumentsService.transferTargets).mockResolvedValue({
      items: [target],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
    jest
      .mocked(stockDocumentsService.createAndPostMvoTransfer)
      .mockResolvedValue({ status: 'POSTED' } as never);
  });

  it('shows the item ledger history and operation actions', async () => {
    render(<MyInventoryItemCard inventoryItemId={itemId} onBack={jest.fn()} />);

    expect(await screen.findByText('Прихід за CSV')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Передати' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Видати' })).toBeTruthy();
    expect(screen.getByText('Бухгалтерський CSV')).toBeTruthy();
    expect(screen.getByText('accountant')).toBeTruthy();
  });

  it('uses semantic column classes and an isolated horizontal scroll container', async () => {
    render(<MyInventoryItemCard inventoryItemId={itemId} onBack={jest.fn()} />);

    const table = await screen.findByRole('table', {
      name: 'Історія руху номенклатури',
    });
    const scrollContainer = table.parentElement;
    const headers = screen.getAllByRole('columnheader');

    expect(table.classList.contains('my-inventory-item-card__table')).toBe(true);
    expect(scrollContainer?.getAttribute('data-scroll-mode')).toBe('horizontal');
    expect(headers[0].classList.contains('my-inventory-item-card__date')).toBe(true);
    expect(headers[2].classList.contains('my-inventory-item-card__quantity')).toBe(true);
    expect(headers[4].classList.contains('my-inventory-item-card__recipient')).toBe(true);
    expect(headers[5].classList.contains('my-inventory-item-card__note')).toBe(true);
  });

  it('keeps readable desktop column widths and resets them for mobile cards', () => {
    const css = readFileSync(
      join(__dirname, '../../styles/components.css'),
      'utf8',
    );

    expect(css).toContain(
      '.my-inventory-item-card__table { width: max(100%, 76rem); min-width: 76rem;',
    );
    expect(css).toContain('.my-inventory-item-card__sender { width: 13rem; }');
    expect(css).toContain('.my-inventory-item-card__recipient { width: 15rem; }');
    expect(css).toContain(".my-inventory-item-card__table[data-responsive='cards-wide'] { width: 100%; min-width: 0;");
    expect(css).not.toMatch(/my-inventory-item-card__table th:nth-child/);
  });

  it('opens the existing transfer form with this item and posts through the existing endpoint', async () => {
    const browser = userEvent.setup();
    render(<MyInventoryItemCard inventoryItemId={itemId} onBack={jest.fn()} />);
    await screen.findByText('Прихід за CSV');

    await browser.click(screen.getByRole('button', { name: 'Передати' }));
    expect(await screen.findByText('Нова передача')).toBeTruthy();
    expect(screen.getAllByText('Клавіатура').length).toBeGreaterThan(1);

    const recipient = screen.getByRole('combobox', {
      name: 'Кому передаємо',
    });
    await browser.click(recipient);
    await browser.click(
      screen.getByRole('option', { name: /0002.*Петренко Петро/ }),
    );
    await browser.type(
      screen.getByRole('spinbutton', { name: 'Кількість рядка 1' }),
      '2',
    );
    await browser.type(
      screen.getByRole('textbox', { name: 'Примітка' }),
      'Для роботи',
    );
    await browser.click(
      screen.getByRole('button', { name: 'Підтвердити передачу' }),
    );

    await waitFor(() =>
      expect(
        stockDocumentsService.createAndPostMvoTransfer,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          destinationResponsiblePersonId: targetId,
          note: 'Для роботи',
          lines: [
            expect.objectContaining({
              inventoryItemId: itemId,
              sourceBalanceId: balanceId,
              quantity: '2',
            }),
          ],
        }),
      ),
    );
    expect(
      await screen.findByText('Передачу проведено. Залишки оновлено.'),
    ).toBeTruthy();
    expect(screen.queryByText('Нова передача')).toBeNull();
  });

  it('opens the existing issue form with the selected nomenclature item', async () => {
    const browser = userEvent.setup();
    render(<MyInventoryItemCard inventoryItemId={itemId} onBack={jest.fn()} />);
    await screen.findByText('Прихід за CSV');

    await browser.click(screen.getByRole('button', { name: 'Видати' }));

    expect(await screen.findByText('Нова видача')).toBeTruthy();
    expect(screen.getAllByText('Клавіатура').length).toBeGreaterThan(1);
    expect(
      screen.getByRole('spinbutton', { name: 'Кількість рядка 1' }),
    ).toHaveProperty('value', '');
  });
});

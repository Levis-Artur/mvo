/** @jest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  AuthUser,
  IssueHistoryItem,
  StockDocument,
} from '@/lib/types';
import { MvoIssuesView } from './mvo-issues-view';
import { stockDocumentsService } from './stock-documents.service';

const personId = '11111111-1111-4111-8111-111111111111';
const balanceId = '22222222-2222-4222-8222-222222222222';
const itemId = '33333333-3333-4333-8333-333333333333';
const documentId = '44444444-4444-4444-8444-444444444444';

const user: AuthUser = {
  id: '55555555-5555-4555-8555-555555555555',
  username: 'mvo',
  role: 'MVO',
  isActive: true,
  mustChangePassword: false,
  responsiblePersonId: personId,
};

jest.mock('@/app/ui/auth-context', () => ({
  useAuth: () => ({ user }),
}));

const historyItem: IssueHistoryItem = {
  id: documentId,
  displayNumber: 15,
  documentDate: '2026-08-10T00:00:00.000Z',
  sourceResponsiblePerson: {
    id: personId,
    fullName: 'Іваненко Іван',
    personnelNumber: '0001',
    externalAccountingCode: '0001',
  },
  recipientName: 'Служба забезпечення',
  note: 'Для роботи',
  status: 'POSTED',
  numberOfLines: 1,
  totalQuantity: '2',
  issuedQuantity: '2',
  realizedQuantity: '1',
  availableToRealize: '1',
  realizationCount: 1,
  isFullyRealized: false,
  hasAttachment: true,
  createdBy: { id: user.id, username: user.username, role: user.role },
  createdAt: '2026-08-10T10:00:00.000Z',
};

const issueDocument = {
  id: documentId,
  displayNumber: 15,
  documentDate: historyItem.documentDate,
  type: 'ISSUE',
  status: 'POSTED',
  sourceResponsiblePersonId: personId,
  sourceResponsiblePerson: {
    id: personId,
    personnelNumber: '0001',
    externalAccountingCode: '0001',
    lastName: 'Іваненко',
    firstName: 'Іван',
    middleName: null,
  },
  destinationResponsiblePersonId: null,
  destinationResponsiblePerson: null,
  recipientName: 'Служба забезпечення',
  recipientUnit: null,
  basis: null,
  note: 'Для роботи',
  createdAt: historyItem.createdAt,
  lines: [
    {
      id: 'line-1',
      inventoryItemId: itemId,
      sourceBalanceId: balanceId,
      inventoryItem: {
        id: itemId,
        externalCode: 'KB-001',
        name: 'Клавіатура',
        unitOfMeasure: 'шт',
      },
      quantity: '2',
    },
  ],
  attachments: [],
  realizations: [],
  issuedQuantity: '2',
  realizedQuantity: '1',
  availableToRealize: '1',
  realizationCount: 1,
  isFullyRealized: false,
  totalPositions: 1,
  totalQuantity: '2',
} as StockDocument;

function historyResponse(items = [historyItem]) {
  return {
    items,
    pagination: {
      page: 1,
      limit: 25,
      total: items.length,
      totalPages: items.length ? 1 : 0,
    },
  };
}

beforeEach(() => {
  jest.spyOn(stockDocumentsService, 'issueHistory').mockResolvedValue(historyResponse());
  jest.spyOn(stockDocumentsService, 'availableToMe').mockResolvedValue([
    {
      balanceId,
      inventoryItem: {
        id: itemId,
        externalCode: 'KB-001',
        name: 'Клавіатура',
        unitOfMeasure: 'шт',
      },
      availableQuantity: '10',
      unit: 'шт',
      canTransfer: true,
      canIssue: true,
    },
  ]);
  jest.spyOn(stockDocumentsService, 'findOne').mockResolvedValue(issueDocument);
  jest.spyOn(stockDocumentsService, 'createAndPostIssue').mockResolvedValue(issueDocument);
  jest.spyOn(stockDocumentsService, 'exportIssueHistory').mockResolvedValue({
    blob: new Blob(['csv']),
    filename: 'issues.csv',
  });
  jest.spyOn(stockDocumentsService, 'createIssueRealization').mockResolvedValue({
    id: '88888888-8888-4888-8888-888888888888',
    issueId: documentId,
    displayNumber: 1,
    realizationDate: '2026-08-11T00:00:00.000Z',
    recipientText: null,
    note: null,
    status: 'POSTED',
    createdByUserId: user.id,
    cancelledByUserId: null,
    createdAt: '2026-08-11T09:00:00.000Z',
    updatedAt: '2026-08-11T09:00:00.000Z',
    cancelledAt: null,
    createdByUser: { id: user.id, username: user.username, role: user.role },
    cancelledByUser: null,
    lines: [],
    attachments: [],
    totalQuantity: '1',
    hasAttachment: false,
    createdBy: { id: user.id, username: user.username, role: user.role },
  });
  jest.spyOn(stockDocumentsService, 'cancelIssueRealization').mockResolvedValue(
    {} as never,
  );
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: jest.fn(() => 'blob:issues'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: jest.fn(),
  });
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe('MVO issues workspace', () => {
  it('shows standalone issue history, compact filters and export', async () => {
    render(<MvoIssuesView />);

    expect(await screen.findByRole('heading', { name: 'Видачі' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '+ Нова видача' })).toBeTruthy();
    expect(screen.getByPlaceholderText('Пошук за №, номенклатурою або одержувачем')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Фільтри' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Експортувати' })).toBeTruthy();
    expect(await screen.findByText('№ 15')).toBeTruthy();
    expect(screen.getByText('Служба забезпечення')).toBeTruthy();
    expect(screen.getByText('Є документ')).toBeTruthy();
  });

  it('creates an ISSUE from the direct balance without transfer identifiers', async () => {
    const browser = userEvent.setup();
    const { container } = render(<MvoIssuesView />);
    await screen.findByText('№ 15');

    await browser.click(screen.getByRole('button', { name: '+ Нова видача' }));
    expect(await screen.findByRole('heading', { name: 'Нова видача' })).toBeTruthy();
    await browser.type(screen.getByRole('textbox', { name: 'Кому видано' }), 'Черговій частині');
    await browser.type(screen.getByRole('textbox', { name: 'Коментар' }), 'Для використання');
    await browser.click(screen.getByRole('button', { name: 'Додати майно' }));
    await browser.click(await screen.findByRole('radio', { name: 'Вибрати Клавіатура' }));
    await browser.click(screen.getByRole('button', { name: 'Додати вибране' }));
    await browser.type(screen.getByRole('spinbutton', { name: 'Кількість рядка 1' }), '2');
    await browser.upload(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      new File(['%PDF-1.7'], 'nakladna.pdf', { type: 'application/pdf' }),
    );
    await browser.click(screen.getByRole('button', { name: 'Підтвердити видачу' }));

    await waitFor(() => expect(stockDocumentsService.createAndPostIssue).toHaveBeenCalledTimes(1));
    expect(stockDocumentsService.createAndPostIssue).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientName: 'Черговій частині',
        note: 'Для використання',
        lines: [
          expect.objectContaining({
            inventoryItemId: itemId,
            sourceBalanceId: balanceId,
            quantity: '2',
          }),
        ],
      }),
      [expect.objectContaining({ name: 'nakladna.pdf' })],
    );
    expect(JSON.stringify((stockDocumentsService.createAndPostIssue as jest.Mock).mock.calls[0])).not.toContain('sourceTransfer');
    expect(await screen.findByText('Видачу успішно оформлено.')).toBeTruthy();
  });

  it('opens read-only details and keeps a cancelled issue in history', async () => {
    const browser = userEvent.setup();
    jest.spyOn(stockDocumentsService, 'issueHistory').mockResolvedValue(
      historyResponse([{ ...historyItem, status: 'CANCELLED' }]),
    );
    render(<MvoIssuesView />);

    expect(await screen.findByText('Скасовано')).toBeTruthy();
    await browser.click(screen.getByRole('button', { name: 'Відкрити' }));
    expect(await screen.findByRole('heading', { name: 'Видача № 15' })).toBeTruthy();
    expect(screen.getByText('Позиції')).toBeTruthy();
    expect(screen.queryByText(/Передача №/)).toBeNull();
  });

  it('creates a partial realization without refreshing StockBalance', async () => {
    const browser = userEvent.setup();
    const dispatch = jest.spyOn(window, 'dispatchEvent');
    render(<MvoIssuesView />);
    await screen.findByText('№ 15');

    await browser.click(screen.getByRole('button', { name: 'Реалізувати' }));
    expect(
      await screen.findByRole('heading', {
        name: 'Реалізація видачі № 15',
      }),
    ).toBeTruthy();
    await browser.type(
      screen.getByRole('spinbutton', { name: /Кількість —/ }),
      '1',
    );
    await browser.click(screen.getByRole('button', { name: 'Підтвердити реалізацію' }));

    await waitFor(() =>
      expect(stockDocumentsService.createIssueRealization).toHaveBeenCalledWith(
        documentId,
        expect.objectContaining({
          lines: [{ issueLineId: 'line-1', quantity: '1' }],
        }),
        [],
      ),
    );
    expect(
      dispatch.mock.calls.some(
        ([event]) => (event as CustomEvent).type === 'mvo:refresh-stock',
      ),
    ).toBe(false);
    expect(
      await screen.findByText('Реалізацію успішно оформлено.'),
    ).toBeTruthy();
  });

  it('shows the fully realized badge instead of the realization action', async () => {
    jest.spyOn(stockDocumentsService, 'issueHistory').mockResolvedValue(
      historyResponse([
        {
          ...historyItem,
          realizedQuantity: '2',
          availableToRealize: '0',
          isFullyRealized: true,
        },
      ]),
    );
    render(<MvoIssuesView />);

    expect(await screen.findByText('Реалізовано повністю')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Реалізувати' })).toBeNull();
  });

  it('exports active filters and renders a useful empty state', async () => {
    const browser = userEvent.setup();
    jest.spyOn(stockDocumentsService, 'issueHistory').mockResolvedValue(historyResponse([]));
    render(<MvoIssuesView />);

    expect(await screen.findByText('Видач ще немає')).toBeTruthy();
    await browser.click(screen.getByRole('button', { name: 'Експортувати' }));
    await waitFor(() => expect(stockDocumentsService.exportIssueHistory).toHaveBeenCalledWith({
      search: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      status: undefined,
      hasAttachment: undefined,
    }));
  });
});

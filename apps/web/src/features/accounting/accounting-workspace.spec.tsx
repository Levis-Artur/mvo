/** @jest-environment jsdom */

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AccountingOverview as AccountingOverviewData } from '@/lib/types';
import { AccountingOverview } from './accounting-overview';
import {
  accountingWorkspaceTabs,
  operationDocumentLabel,
  operationPersonLabel,
} from './accounting-workspace-model';
import { can } from '@/lib/authz';
import type { AuthUser } from '@/lib/types';

const mockOverview = jest.fn<() => Promise<AccountingOverviewData>>();

jest.mock('./accounting-transfers.service', () => ({
  accountingTransfersService: {
    overview: () => mockOverview(),
  },
}));

const overview: AccountingOverviewData = {
  metrics: {
    activeResponsiblePersons: 12,
    inventoryItems: 34,
    unexportedTransfers: 3,
    currentMonthTransactions: 9,
  },
  lastImport: {
    id: 'import-id',
    originalFilename: 'залишки.csv',
    status: 'COMPLETED',
    createdAt: '2026-08-02T10:00:00.000Z',
    completedAt: '2026-08-02T10:05:00.000Z',
  },
  recentOperations: [{
    id: 'transaction-id',
    type: 'IMPORT_RECEIPT',
    quantity: '5',
    occurredAt: '2026-08-03T10:00:00.000Z',
    sourceDocument: 'залишки.csv',
    comment: null,
    document: null,
    responsiblePerson: {
      personnelNumber: '001',
      externalAccountingCode: 'MVO-001',
      lastName: 'Тестовий',
      firstName: 'Користувач',
      middleName: null,
    },
    inventoryItem: {
      externalCode: 'KB-1',
      name: 'Клавіатура',
      unitOfMeasure: 'шт.',
    },
  }],
};

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

describe('Accounting workspace', () => {
  it('is read-only for ACCOUNTANT and unavailable to MVO', () => {
    const user = (role: AuthUser['role']): AuthUser => ({
      id: role,
      username: role.toLowerCase(),
      role,
      isActive: true,
      mustChangePassword: false,
      responsiblePersonId: role === 'MVO' ? 'person-1' : null,
    });

    expect(can(user('ACCOUNTANT'), 'read', 'accounting')).toBe(true);
    expect(can(user('MVO'), 'read', 'accounting')).toBe(false);
  });

  it('defines the compact five-tab workspace', () => {
    expect(accountingWorkspaceTabs.map((tab) => tab.label)).toEqual([
      'Огляд',
      'Імпорт',
      'Передачі МВО',
      'Рух майна',
      'Залишки',
    ]);
  });

  it('shows actual overview metrics, the latest import and recent operations', async () => {
    mockOverview.mockResolvedValue(overview);

    render(<AccountingOverview />);

    expect(await screen.findByText('12')).toBeTruthy();
    expect(screen.getByText('34')).toBeTruthy();
    expect(screen.getAllByText('залишки.csv')).toHaveLength(2);
    expect(screen.getByText('Прихід через імпорт')).toBeTruthy();
    expect(screen.getByText('MVO-001 — Тестовий Користувач')).toBeTruthy();
  });

  it('shows an API error and retries loading', async () => {
    mockOverview
      .mockRejectedValueOnce(new Error('Сервіс недоступний'))
      .mockResolvedValueOnce(overview);
    const user = userEvent.setup();

    render(<AccountingOverview />);

    expect(await screen.findByText('Сервіс недоступний')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Повторити' }));
    await waitFor(() => expect(mockOverview).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('12')).toBeTruthy();
  });

  it('uses human-readable MVO and document labels', () => {
    const operation = overview.recentOperations[0];
    expect(operationPersonLabel(operation)).toBe(
      'MVO-001 — Тестовий Користувач',
    );
    expect(operationDocumentLabel(operation)).toBe('залишки.csv');
  });
});

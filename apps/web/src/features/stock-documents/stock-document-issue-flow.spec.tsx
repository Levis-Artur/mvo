/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  AuthUser,
  AvailableStockSource,
  StockDocumentInput,
  StockDocument,
} from '@/lib/types';
import { StockDocumentForm } from './stock-document-form';

const sourceId = '11111111-1111-4111-8111-111111111111';
const balanceId = '22222222-2222-4222-8222-222222222222';
const itemId = '33333333-3333-4333-8333-333333333333';

const user: AuthUser = {
  id: '44444444-4444-4444-8444-444444444444',
  username: 'mvo',
  role: 'MVO',
  isActive: true,
  mustChangePassword: false,
  responsiblePersonId: sourceId,
};

const source: AvailableStockSource = {
  inventoryItem: {
    id: itemId,
    externalCode: 'KB-001',
    name: 'Клавіатура',
    unitOfMeasure: 'шт',
  },
  balanceId,
  sourceTransferLineId: balanceId,
  availableQuantity: '10',
  unit: 'шт',
  canTransfer: true,
  canIssue: true,
};

const transfer = {
  id: '55555555-5555-4555-8555-555555555555',
  displayNumber: 7,
  sourceResponsiblePersonId: sourceId,
  type: 'MVO_TRANSFER',
  status: 'POSTED',
  lines: [
    {
      id: balanceId,
      inventoryItem: source.inventoryItem,
      quantity: '10',
      issuedQuantity: '0',
      availableToIssue: '10',
    },
  ],
} as StockDocument;

afterEach(cleanup);

function issueForm({
  onSubmit = jest.fn(async () => undefined),
  saving = false,
  initialIssueLineId,
}: {
  onSubmit?: (input: StockDocumentInput, files: File[]) => Promise<void>;
  saving?: boolean;
  initialIssueLineId?: string;
} = {}) {
  return (
    <StockDocumentForm
      availableSources={[source]}
      document={null}
      sourceTransfer={transfer}
      error=""
      initialIssueLineId={initialIssueLineId}
      initialSourceId={sourceId}
      loadingSources={false}
      loadingTargets={false}
      persons={[]}
      saving={saving}
      sourcesError=""
      targetsError=""
      transferTargets={[]}
      type="ISSUE"
      user={user}
      onClose={jest.fn()}
      onRemoveAttachment={jest.fn(async () => undefined)}
      onSourceChange={jest.fn(async () => undefined)}
      onSubmit={onSubmit}
    />
  );
}

describe('new ISSUE form', () => {
  it('opens in transfer context with the selected line and available maximum', () => {
    render(issueForm({ initialIssueLineId: balanceId }));

    expect(screen.getByText('Видача переданого майна')).toBeTruthy();
    expect(screen.getByText(/Передача № 7/)).toBeTruthy();
    const quantity = screen.getByRole('spinbutton', {
      name: 'Кількість рядка 1',
    });
    expect(quantity.getAttribute('max')).toBe('10');
    expect((quantity as HTMLInputElement).value).toBe('');
  });

  it('shows the single confirmation action without draft-only fields', () => {
    render(issueForm());

    expect(
      screen.getByRole('button', { name: 'Підтвердити видачу' }),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Зберегти чернетку' }),
    ).toBeNull();
    expect(screen.queryByLabelText('Мета або підстава')).toBeNull();
    expect(screen.queryByLabelText('Підрозділ одержувача')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.getByText('Підтверджуючий документ')).toBeTruthy();
  });

  it('keeps focus in recipient and note fields during continuous input', async () => {
    const browser = userEvent.setup();
    render(issueForm());
    const recipient = screen.getByRole('textbox', { name: 'Кому видано' });
    const note = screen.getByRole('textbox', { name: 'Примітка' });

    await browser.click(recipient);
    await browser.type(recipient, 'Старший лейтенант поліції Іваненко');
    expect(document.activeElement).toBe(recipient);

    await browser.click(note);
    await browser.type(note, 'Призначення та додаткова інформація');
    expect(document.activeElement).toBe(note);
  });

  it('submits recipient, note, lines and attachment through one form action', async () => {
    const browser = userEvent.setup();
    const onSubmit = jest.fn(async () => undefined);
    const { container } = render(issueForm({ onSubmit }));

    await browser.type(
      screen.getByRole('textbox', { name: 'Кому видано' }),
      'Служба забезпечення',
    );
    await browser.type(
      screen.getByRole('textbox', { name: 'Примітка' }),
      'Для роботи',
    );
    await browser.click(screen.getByRole('button', { name: 'Додати позицію' }));
    await browser.click(
      screen.getByRole('radio', { name: 'Вибрати Клавіатура' }),
    );
    await browser.click(
      screen.getByRole('button', { name: 'Додати вибране' }),
    );
    const quantity = screen.getByRole('spinbutton', {
      name: 'Кількість рядка 1',
    });
    await browser.clear(quantity);
    await browser.type(quantity, '2');
    const file = new File(['%PDF-1.7'], 'invoice.pdf', {
      type: 'application/pdf',
    });
    await browser.upload(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      file,
    );
    await browser.click(
      screen.getByRole('button', { name: 'Підтвердити видачу' }),
    );

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'ISSUE',
        sourceResponsiblePersonId: sourceId,
        recipientName: 'Служба забезпечення',
        recipientUnit: undefined,
        basis: undefined,
        note: 'Для роботи',
        lines: [
          expect.objectContaining({
            inventoryItemId: itemId,
            sourceBalanceId: balanceId,
            sourceTransferLineId: balanceId,
            quantity: '2',
          }),
        ],
      }),
      [file],
    );
  });

  it('blocks submission without an attachment and shows the loading label', async () => {
    const browser = userEvent.setup();
    const onSubmit = jest.fn(async () => undefined);
    const view = render(issueForm({ onSubmit }));

    await browser.type(
      screen.getByRole('textbox', { name: 'Кому видано' }),
      'Одержувач',
    );
    await browser.click(screen.getByRole('button', { name: 'Додати позицію' }));
    await browser.click(
      screen.getByRole('radio', { name: 'Вибрати Клавіатура' }),
    );
    await browser.click(
      screen.getByRole('button', { name: 'Додати вибране' }),
    );
    await browser.type(
      screen.getByRole('spinbutton', { name: 'Кількість рядка 1' }),
      '1',
    );
    fireEvent.submit(
      document.getElementById('stock-document-form') as HTMLFormElement,
    );

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText(/додайте хоча б одне фото або скан накладної/i),
    ).toBeTruthy();

    view.rerender(issueForm({ onSubmit, saving: true }));
    expect(screen.getByRole('button', { name: 'Видаємо…' })).toHaveProperty(
      'disabled',
      true,
    );
  });
});

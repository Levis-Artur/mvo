/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {
  AuthUser,
  AvailableStockSource,
  StockDocumentInput,
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
  availableQuantity: '10',
  unit: 'шт',
  canTransfer: true,
  canIssue: true,
};

afterEach(cleanup);

function issueForm({
  onSubmit = jest.fn(async () => undefined),
  saving = false,
  initialInventoryItemId,
}: {
  onSubmit?: (input: StockDocumentInput, files: File[]) => Promise<void>;
  saving?: boolean;
  initialInventoryItemId?: string;
} = {}) {
  return (
    <StockDocumentForm
      availableSources={[source]}
      document={null}
      error=""
      initialInventoryItemId={initialInventoryItemId}
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
  it('preselects the item opened from its card and leaves quantity empty', () => {
    render(issueForm({ initialInventoryItemId: itemId }));

    expect(screen.getByText('Клавіатура')).toBeTruthy();
    expect(
      screen.getByRole('spinbutton', { name: 'Кількість рядка 1' }),
    ).toHaveProperty('value', '');
  });

  it('opens as a standalone issue without transfer context', () => {
    render(issueForm());

    expect(screen.getByText('Нова видача')).toBeTruthy();
    expect(screen.queryByText(/Передача №/)).toBeNull();
    expect(screen.getAllByText(/поточного залишку/i)).toHaveLength(2);
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
    const note = screen.getByRole('textbox', { name: 'Коментар' });

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
      screen.getByRole('textbox', { name: 'Коментар' }),
      'Для роботи',
    );
    await browser.click(screen.getByRole('button', { name: 'Додати майно' }));
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
    await browser.click(screen.getByRole('button', { name: 'Додати майно' }));
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

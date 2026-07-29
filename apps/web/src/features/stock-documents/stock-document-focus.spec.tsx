/** @jest-environment jsdom */

import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, Modal } from '@/components/ui';
import type {
  AuthUser,
  AvailableStockSource,
  TransferTarget,
} from '@/lib/types';
import { StockDocumentForm } from './stock-document-form';

const sourceId = '11111111-1111-4111-8111-111111111111';
const destinationId = '22222222-2222-4222-8222-222222222222';
const balanceId = '33333333-3333-4333-8333-333333333333';
const itemId = '44444444-4444-4444-8444-444444444444';

const authUser: AuthUser = {
  id: '55555555-5555-4555-8555-555555555555',
  username: 'mvo',
  role: 'MVO',
  isActive: true,
  mustChangePassword: false,
  responsiblePersonId: sourceId,
};

const target: TransferTarget = {
  id: destinationId,
  personnelNumber: '003',
  externalAccountingCode: '0057',
  fullName: 'Левіс Артур Сергійович',
  management: { id: 'management-id', name: 'Управління забезпечення' },
  service: { id: 'service-id', name: 'Служба майна' },
  unit: null,
};

const source: AvailableStockSource = {
  inventoryItem: {
    id: itemId,
    externalCode: 'KB-001',
    name: 'Клавіатура',
    unitOfMeasure: 'шт',
  },
  balanceId,
  availableQuantity: '500',
  unit: 'шт',
  canTransfer: true,
  canIssue: true,
};

afterEach(cleanup);

function transferForm(overrides: { error?: string; onClose?: () => void } = {}) {
  return (
    <StockDocumentForm
      availableSources={[source]}
      document={null}
      error={overrides.error ?? ''}
      initialSourceId={sourceId}
      loadingSources={false}
      loadingTargets={false}
      persons={[]}
      saving={false}
      sourcesError=""
      targetsError=""
      transferTargets={[target]}
      type="MVO_TRANSFER"
      user={authUser}
      onClose={overrides.onClose ?? jest.fn()}
      onRemoveAttachment={jest.fn(async () => undefined)}
      onSourceChange={jest.fn(async () => undefined)}
      onSubmit={jest.fn(async () => undefined)}
    />
  );
}

describe('new transfer modal focus lifecycle', () => {
  it('keeps focus and caret in the note during continuous Cyrillic input', async () => {
    const user = userEvent.setup();
    render(transferForm());
    const note = screen.getByRole('textbox', { name: 'Примітка' });

    await user.click(note);
    await user.type(note, 'Перевірка безперервного введення тексту');

    expect((note as HTMLTextAreaElement).value).toBe(
      'Перевірка безперервного введення тексту',
    );
    expect(document.activeElement).toBe(note);
  });

  it('keeps recipient search focused while suggestions update and after selection', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    render(transferForm({ onClose }));
    const recipient = screen.getByRole('combobox', {
      name: /Кому передаємо/,
    });

    await user.click(recipient);
    await user.type(recipient, 'Лев');

    expect(await screen.findByRole('option', { name: /Левіс Артур/ })).toBeTruthy();
    expect(document.activeElement).toBe(recipient);

    await user.keyboard('{Enter}');
    expect((recipient as HTMLInputElement).value).toContain(
      '0057 — Левіс Артур Сергійович',
    );
    expect(document.activeElement).toBe(recipient);

    await user.click(recipient);
    await user.type(recipient, 'Ар');
    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(recipient);
    await user.keyboard('{Escape}');
    expect(
      screen.getByRole('heading', {
        name: 'Закрити форму без збереження?',
      }),
    ).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps the quantity input mounted and focused while totals and validation update', async () => {
    const user = userEvent.setup();
    render(transferForm());

    await user.click(screen.getByRole('button', { name: 'Додати позицію' }));
    await user.click(
      screen.getByRole('radio', { name: 'Вибрати Клавіатура' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Додати вибране' }),
    );

    const quantity = screen.getByRole('spinbutton', {
      name: 'Кількість рядка 1',
    });
    await user.clear(quantity);
    await user.type(quantity, '125');

    expect((quantity as HTMLInputElement).value).toBe('125');
    expect(document.activeElement).toBe(quantity);
    expect(screen.getByText('125', { selector: 'strong' })).toBeTruthy();
  });

  it('does not rerun initial focus when parent props and validation state change', async () => {
    const user = userEvent.setup();
    const view = render(transferForm());
    const note = screen.getByRole('textbox', { name: 'Примітка' });

    await user.click(note);
    await user.type(note, 'Текст');
    view.rerender(transferForm({ error: 'Перевірте заповнення форми' }));

    expect(document.activeElement).toBe(note);
    expect(screen.getByText('Перевірте заповнення форми')).toBeTruthy();
    expect(
      screen
        .getAllByRole('button', { name: 'Закрити' })
        .includes(document.activeElement as HTMLButtonElement),
    ).toBe(false);
  });

  it('traps Tab navigation and restores focus to the opener after Escape', async () => {
    const user = userEvent.setup();
    render(<ModalKeyboardHarness />);
    const opener = screen.getByRole('button', { name: 'Відкрити форму' });

    await user.click(opener);
    const first = screen.getByRole('textbox', { name: 'Перше поле' });
    const second = screen.getByRole('textbox', { name: 'Друге поле' });
    expect(document.activeElement).toBe(first);

    await user.tab();
    expect(document.activeElement).toBe(second);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(first);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});

function ModalKeyboardHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Відкрити форму
      </Button>
      {open ? (
        <Modal
          footer={<Button type="button">Зберегти</Button>}
          onClose={() => setOpen(false)}
          title="Тестова форма"
        >
          <input
            aria-label="Перше поле"
            data-modal-initial-focus="true"
          />
          <textarea aria-label="Друге поле" />
        </Modal>
      ) : null}
    </>
  );
}

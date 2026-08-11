/** @jest-environment jsdom */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { StockDocument } from '@/lib/types';
import { IssueRealizationFormModal } from './issue-realization-form-modal';

const issue = {
  id: 'issue-id',
  displayNumber: 2,
  recipientName: 'Левіс Артур',
  lines: [
    {
      id: 'line-1',
      quantity: '50',
      realizedQuantity: '20',
      availableToRealize: '30',
      inventoryItem: {
        id: 'item-1',
        externalCode: 'KB-1',
        name: 'Клавіатура',
        unitOfMeasure: 'шт.',
      },
    },
    {
      id: 'line-2',
      quantity: '10',
      realizedQuantity: '0',
      availableToRealize: '10',
      inventoryItem: {
        id: 'item-2',
        externalCode: 'MS-1',
        name: 'Миша',
        unitOfMeasure: 'шт.',
      },
    },
  ],
} as StockDocument;

afterEach(cleanup);

describe('IssueRealizationFormModal', () => {
  it('renders the compact fields and submits partial quantities for multiple lines', async () => {
    const browser = userEvent.setup();
    const onSubmit = jest.fn();
    const { container } = render(
      <IssueRealizationFormModal
        error=""
        issue={issue}
        saving={false}
        onClose={jest.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Реалізація видачі № 2' })).toBeTruthy();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('data-size')).toBe('medium');
    const date = screen.getByLabelText(/Дата реалізації/) as HTMLInputElement;
    expect(date.type).toBe('date');
    expect(date.value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const recipientNote = screen.getByRole('textbox', {
      name: 'Примітка до одержувача',
    });
    await browser.type(recipientNote, 'Уточнення для одержувача');
    expect(document.activeElement).toBe(recipientNote);
    expect(screen.getAllByText('Видано')).toHaveLength(2);
    expect(screen.getAllByText('Реалізовано')).toHaveLength(2);
    expect(screen.getAllByText('Залишилось')).toHaveLength(2);
    expect(screen.getByText('Код: KB-1')).toBeTruthy();
    expect(screen.getByText('Код: MS-1')).toBeTruthy();

    const submit = screen.getByRole('button', { name: 'Підтвердити реалізацію' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    const [first, second] = screen.getAllByRole('spinbutton', {
      name: 'Кількість до реалізації',
    });
    await browser.type(first, '10');
    expect(document.activeElement).toBe(first);
    await browser.type(second, '2.5');
    const comment = screen.getByRole('textbox', { name: 'Коментар' });
    await browser.type(comment, 'Часткова реалізація кількох позицій');
    expect(document.activeElement).toBe(comment);
    expect(submit.disabled).toBe(false);
    const file = new File(['%PDF-1.7'], 'акт.pdf', {
      type: 'application/pdf',
    });
    expect(screen.getByRole('button', { name: 'Обрати файл' })).toBeTruthy();
    await browser.upload(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      file,
    );
    expect(screen.getByText('акт.pdf')).toBeTruthy();
    await browser.click(submit);

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientText: 'Уточнення для одержувача',
        note: 'Часткова реалізація кількох позицій',
        lines: [
          { issueLineId: 'line-1', quantity: '10' },
          { issueLineId: 'line-2', quantity: '2.5' },
        ],
      }),
      [file],
    );
  });

  it('keeps the modal open and blocks a quantity above available', async () => {
    const browser = userEvent.setup();
    const onSubmit = jest.fn();
    render(
      <IssueRealizationFormModal
        error=""
        issue={issue}
        saving={false}
        onClose={jest.fn()}
        onSubmit={onSubmit}
      />,
    );
    const first = screen.getAllByRole('spinbutton', {
      name: 'Кількість до реалізації',
    })[0] as HTMLInputElement;
    expect(first.max).toBe('30');
    await browser.type(first, '31');
    const submit = screen.getByRole('button', {
      name: 'Підтвердити реалізацію',
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText('Кількість не може перевищувати 30 шт.'),
    ).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('removes a selected attachment without changing secure file types', async () => {
    const browser = userEvent.setup();
    const { container } = render(
      <IssueRealizationFormModal
        error=""
        issue={issue}
        saving={false}
        onClose={jest.fn()}
        onSubmit={jest.fn()}
      />,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toBe(
      'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf',
    );
    const file = new File(['%PDF-1.7'], 'підтвердження.pdf', {
      type: 'application/pdf',
    });
    await browser.upload(input, file);
    expect(screen.getByText('підтвердження.pdf')).toBeTruthy();
    await browser.click(
      screen.getByRole('button', {
        name: 'Видалити файл підтвердження.pdf',
      }),
    );
    expect(screen.queryByText('підтвердження.pdf')).toBeNull();
  });

  it('keeps focus in recipient, comment and quantity fields while typing', async () => {
    const browser = userEvent.setup();
    render(
      <IssueRealizationFormModal
        error=""
        issue={issue}
        saving={false}
        onClose={jest.fn()}
        onSubmit={jest.fn()}
      />,
    );
    const recipientNote = screen.getByRole('textbox', {
      name: 'Примітка до одержувача',
    });
    const comment = screen.getByRole('textbox', { name: 'Коментар' });
    const quantity = screen.getAllByRole('spinbutton', {
      name: 'Кількість до реалізації',
    })[0];

    await browser.type(recipientNote, 'Довге уточнення без втрати фокусу');
    expect(document.activeElement).toBe(recipientNote);
    await browser.type(comment, 'Довгий коментар без повторного кліку');
    expect(document.activeElement).toBe(comment);
    await browser.type(quantity, '12.5');
    expect(document.activeElement).toBe(quantity);
    expect(document.activeElement).not.toBe(
      screen.getByRole('button', { name: 'Закрити' }),
    );
  });

  it('shows the submitting state and blocks repeated confirmation', () => {
    render(
      <IssueRealizationFormModal
        error=""
        issue={issue}
        saving
        onClose={jest.fn()}
        onSubmit={jest.fn()}
      />,
    );

    const submit = screen.getByRole('button', {
      name: 'Оформлюємо…',
    }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });

  it('uses stacked responsive fields and cards without a wide inner table', () => {
    const component = readFileSync(
      join(__dirname, 'issue-realization-form-modal.tsx'),
      'utf8',
    );
    const responsive = readFileSync(
      join(__dirname, '../../styles/responsive.css'),
      'utf8',
    );

    expect(component).not.toContain('size="large"');
    expect(component).not.toContain(`<${'table'}`);
    expect(component).toContain('className="issue-realization-line"');
    expect(responsive).toContain(
      '.issue-realization-form__fields { grid-template-columns: minmax(0, 1fr); }',
    );
    expect(responsive).toContain(
      '.issue-realization-attachment__choose { width: 100%; }',
    );
  });
});

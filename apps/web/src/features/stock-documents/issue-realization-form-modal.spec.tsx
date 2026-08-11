/** @jest-environment jsdom */

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
  it('submits partial quantities for multiple lines with an optional attachment', async () => {
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

    expect(screen.getByText(/видано 50 · реалізовано 20 · доступно 30/)).toBeTruthy();
    const first = screen.getByRole('spinbutton', { name: /Кількість — Клавіатура/ });
    const second = screen.getByRole('spinbutton', { name: /Кількість — Миша/ });
    await browser.type(first, '10');
    expect(document.activeElement).toBe(first);
    await browser.type(second, '2.5');
    const comment = screen.getByRole('textbox', { name: 'Коментар' });
    await browser.type(comment, 'Часткова реалізація кількох позицій');
    expect(document.activeElement).toBe(comment);
    const file = new File(['%PDF-1.7'], 'акт.pdf', {
      type: 'application/pdf',
    });
    await browser.upload(
      container.querySelector('input[type="file"]') as HTMLInputElement,
      file,
    );
    await browser.click(
      screen.getByRole('button', { name: 'Підтвердити реалізацію' }),
    );

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
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
    await browser.type(
      screen.getByRole('spinbutton', { name: /Кількість — Клавіатура/ }),
      '31',
    );
    await browser.click(
      screen.getByRole('button', { name: 'Підтвердити реалізацію' }),
    );
    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText('Кількість має бути більшою за нуль і не перевищувати доступну.'),
    ).toBeTruthy();
  });
});

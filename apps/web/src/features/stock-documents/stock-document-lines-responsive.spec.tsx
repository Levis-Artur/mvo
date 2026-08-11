/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AvailableStockSource } from '@/lib/types';
import { StockDocumentLines } from './stock-document-lines';
import type { DocumentFormLine } from './stock-document.types';

const source: AvailableStockSource = {
  balanceId: 'balance-1',
  availableQuantity: '10.5',
  canIssue: true,
  canTransfer: true,
  inventoryItem: {
    id: 'item-1',
    externalCode: 'KB-001',
    name: 'Клавіатура з довгою читабельною назвою',
    unitOfMeasure: 'шт.',
  },
  unit: 'шт.',
};

const line: DocumentFormLine = {
  inventoryItemId: 'item-1',
  sourceBalanceId: 'balance-1',
  quantity: '2',
  note: '',
};

afterEach(cleanup);

describe('StockDocumentLines responsive table', () => {
  it('renders issue fields as responsive cards while preserving input updates', () => {
    const onChange = jest.fn();
    render(
      <StockDocumentLines
        disabled={false}
        lines={[line]}
        loading={false}
        sources={[source]}
        type="ISSUE"
        onAddRequest={jest.fn()}
        onChange={onChange}
      />,
    );

    const table = screen.getByRole('table', {
      name: 'Рядки документа видачі майна',
    });
    expect(table.getAttribute('data-responsive')).toBe('cards-wide');
    expect(
      screen.getByRole('spinbutton', { name: 'Кількість рядка 1' }).closest('td')
        ?.dataset.label,
    ).toBe('Кількість');

    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '3.25' },
    });
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ quantity: '3.25' }),
    ]);
  });

  it('keeps the existing remove action in transfer card layout', () => {
    const onChange = jest.fn();
    render(
      <StockDocumentLines
        disabled={false}
        lines={[line]}
        loading={false}
        sources={[source]}
        type="MVO_TRANSFER"
        onAddRequest={jest.fn()}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('table').getAttribute('data-responsive')).toBe(
      'cards-wide',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Видалити рядок 1' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

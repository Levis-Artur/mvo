/** @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DataTable } from './data-table';

afterEach(cleanup);

describe('DataTable responsive structure', () => {
  it('uses natural page height by default and exposes labels for card layout', () => {
    render(
      <DataTable
        ariaLabel="Майно"
        columns={[{ label: 'Код' }, { label: 'Назва' }]}
        responsiveMode="cards"
        rows={[['001', 'Клавіатура']]}
      />,
    );

    const table = screen.getByRole('table', { name: 'Майно' });
    const wrapper = table.parentElement;
    expect(wrapper?.getAttribute('data-scroll-mode')).toBe('natural');
    expect(wrapper?.classList.contains('compact-scrollbar')).toBe(false);
    expect(table.getAttribute('data-responsive')).toBe('cards');
    expect(screen.getByText('Клавіатура').closest('td')?.dataset.label).toBe(
      'Назва',
    );
  });

  it('enables horizontal fallback only when the caller requests it', () => {
    render(
      <DataTable
        ariaLabel="Широкий реєстр"
        columns={[{ label: 'Поле' }]}
        rows={[['Значення']]}
        scrollMode="horizontal"
      />,
    );

    const wrapper = screen.getByRole('table').parentElement;
    expect(wrapper?.getAttribute('data-scroll-mode')).toBe('horizontal');
    expect(wrapper?.classList.contains('compact-scrollbar')).toBe(true);
  });

  it('preserves mouse and keyboard row activation in responsive mode', () => {
    const onRowClick = jest.fn();
    render(
      <DataTable
        ariaLabel="Інтерактивний список"
        columns={[{ label: 'Назва' }]}
        responsiveMode="cards-wide"
        rows={[['Клавіатура']]}
        onRowClick={onRowClick}
      />,
    );

    const row = screen.getByRole('row', { name: 'Клавіатура' });
    fireEvent.click(row);
    fireEvent.keyDown(row, { key: 'Enter' });
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });
});
